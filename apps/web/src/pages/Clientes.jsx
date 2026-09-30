import { useEffect, useState } from "react";
import axios from "axios";
import { buildApiUrl } from "../config/api";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [name, setName] = useState("");

  const load = () =>
    axios.get(buildApiUrl('/clients'))
      .then(r => setClientes(r.data));

  useEffect(load, []);

  const create = async () => {
    await axios.post(buildApiUrl('/clients'), {
      name,
      contact: "Contato padrão",
      status: "Ativo"
    });
    setName("");
    load();
  };

  return (
    <>
      <h1>Clientes</h1>

      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nome do cliente"
      />
      <button onClick={create}>Adicionar</button>

      <ul>
        {clientes.map(c => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </>
  );
}
