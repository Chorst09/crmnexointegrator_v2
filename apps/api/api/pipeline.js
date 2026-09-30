
import { prisma } from '../lib/prisma';
export default async function handler() {
  const data = await prisma.opportunity.findMany();
  return Response.json(data);
}
