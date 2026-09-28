
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";
import { PricingInput, PricingOutput } from "@/app/lib/pricing-engine";

export interface SavedScenarioMetadata {
  proposalNumber?: string;
  clientCompany?: string;
  clientContact?: string;
  opportunityNumber?: string;
  opportunityTitle?: string;
  allocation?: {
    id: string;
    name: string;
    method: 'proportional' | 'equal';
    durationMonths: number;
    totalMonthlyAllocated: number;
    results: Array<{
      productId: string;
      name: string;
      originalMonthlyCost: number;
      allocatedMonthlyCost: number;
      totalMonthlyCost: number;
      saleMonthlyPrice?: number;
      percentageOfTotal: number;
      breakdown: Array<{
        sourceName: string;
        amount: number;
      }>;
    }>;
  };
}

export interface SavedScenario {
  id: string;
  inputs: PricingInput;
  results: PricingOutput;
  metadata?: SavedScenarioMetadata;
  createdAt: Timestamp;
}

const SCENARIOS_COLLECTION = "pricingScenarios";
const LOCAL_SCENARIOS_KEY = "precificacao_pricing_scenarios_v1";

const readLocalScenarios = (): SavedScenario[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SCENARIOS_KEY) || "[]") as SavedScenario[];
  } catch {
    return [];
  }
};

const saveLocalScenario = (inputs: PricingInput, results: PricingOutput, metadata?: SavedScenarioMetadata) => {
  const scenario = {
    id: crypto.randomUUID?.() || `${Date.now()}`,
    inputs,
    results,
    metadata,
    createdAt: {
      toDate: () => new Date(),
    },
  } as SavedScenario;

  const next = [scenario, ...readLocalScenarios()].slice(0, 10);
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(next));
  return scenario.id;
};

export const scenarioService = {
  async saveScenario(inputs: PricingInput, results: PricingOutput, metadata?: SavedScenarioMetadata) {
    try {
      // Verifica se o Firebase está inicializado (evita erro se as envs estiverem vazias)
      if (!db) {
        console.warn("Firebase não inicializado. O cenário não será salvo.");
        return saveLocalScenario(inputs, results, metadata);
      }

      // Limpeza profunda para garantir que os dados são serializáveis para o Firestore
      const cleanInputs = JSON.parse(JSON.stringify(inputs));
      const cleanResults = JSON.parse(JSON.stringify(results));
      const cleanMetadata = JSON.parse(JSON.stringify(metadata || {}));

      const docRef = await addDoc(collection(db, SCENARIOS_COLLECTION), {
        inputs: cleanInputs,
        results: cleanResults,
        metadata: cleanMetadata,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao salvar cenário no Firestore:", error);
      throw error;
    }
  },

  async getLatestScenarios(max = 10): Promise<SavedScenario[]> {
    try {
      if (!db) return readLocalScenarios().slice(0, max);
      
      const q = query(
        collection(db, SCENARIOS_COLLECTION), 
        orderBy("createdAt", "desc"), 
        limit(max)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedScenario[];
    } catch (error) {
      console.error("Erro ao buscar cenários:", error);
      return [];
    }
  },

  async deleteScenario(id: string) {
    try {
      if (!db) {
        const local = readLocalScenarios();
        const next = local.filter(item => item.id !== id);
        localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(next));
        return;
      }
      await deleteDoc(doc(db, SCENARIOS_COLLECTION, id));
    } catch (error) {
      console.error("Erro ao excluir cenário:", error);
      throw error;
    }
  },

  async updateScenario(id: string, inputs: PricingInput, results: PricingOutput) {
    try {
      const cleanInputs = JSON.parse(JSON.stringify(inputs));
      const cleanResults = JSON.parse(JSON.stringify(results));

      if (!db) {
        const local = readLocalScenarios();
        const next = local.map(item =>
          item.id === id
            ? { ...item, inputs: cleanInputs, results: cleanResults, createdAt: { toDate: () => new Date() } as Timestamp }
            : item
        );
        localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(next));
        return;
      }
      await updateDoc(doc(db, SCENARIOS_COLLECTION, id), {
        inputs: cleanInputs,
        results: cleanResults,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao atualizar cenário:", error);
      throw error;
    }
  }
};
