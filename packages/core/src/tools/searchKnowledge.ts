import { searchKnowledge } from "../db/vectorStore";

export const searchKnowledgeTool = {
  name: "search_knowledge",
  description:
    "Cerca nelle informazioni caricate (manuali, schede prodotto, siti web, testi). Usa questo tool per rispondere a domande su prodotti, istruzioni, ricambi, coperture, disponibilità e qualsiasi informazione fornita dal cliente.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "La domanda o il termine da cercare nella knowledge base",
      },
    },
    required: ["query"],
  },
  async execute(args: { query: string }) {
    const results = await searchKnowledge(args.query, 5);
    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Nessuna informazione trovata per questa query nella knowledge base.",
          },
        ],
      };
    }
    const formatted = results
      .map((r, i) => `[${i + 1}] Fonte: ${r.source}\n${r.content}`)
      .join("\n\n---\n\n");
    return {
      content: [
        {
          type: "text",
          text: formatted,
        },
      ],
    };
  },
};
