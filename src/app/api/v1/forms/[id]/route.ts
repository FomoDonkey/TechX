import { ApiError } from "@/api/errors";
import { createRoute } from "@/api/runtime";
import { FormDetailParams, FormResourceSchema, getFormHandler } from "@/api/v1/forms";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/forms/{id}",
  tag: "Forms",
  summary: "Obtiene un formulario",
  scopes: ["forms:read"],
  params: FormDetailParams,
  response: FormResourceSchema,
  handler: async (i) => {
    const out = await getFormHandler(i);
    if (!out) throw new ApiError("not_found", "Form no encontrado");
    return out;
  },
});
