import { z } from "zod";

// ========== Security Validation Schemas ==========
// Centralized validation to prevent SQL injection and other attacks

// User authentication
export const emailSchema = z
  .string()
  .trim()
  .email("Email inválido")
  .max(255, "Email muito longo")
  .transform((val) => val.toLowerCase());

export const passwordSchema = z
  .string()
  .min(6, "Senha deve ter pelo menos 6 caracteres")
  .max(128, "Senha muito longa");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = loginSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras"),
  phone: z
    .string()
    .trim()
    .max(20, "Telefone inválido")
    .regex(/^[\d\s\(\)\-\+]*$/, "Telefone inválido")
    .optional()
    .or(z.literal("")),
});

// Customer/Order data
export const customerNameSchema = z
  .string()
  .trim()
  .min(2, "Nome deve ter pelo menos 2 caracteres")
  .max(100, "Nome muito longo");

export const phoneSchema = z
  .string()
  .trim()
  .max(20, "Telefone inválido")
  .regex(/^[\d\s\(\)\-\+]*$/, "Telefone inválido")
  .optional()
  .or(z.literal(""));

export const addressSchema = z
  .string()
  .trim()
  .min(5, "Endereço muito curto")
  .max(200, "Endereço muito longo");

export const bairroSchema = z
  .string()
  .trim()
  .min(2, "Bairro obrigatório")
  .max(100, "Bairro muito longo");

// Menu/Item data
export const itemNameSchema = z
  .string()
  .trim()
  .min(2, "Nome deve ter pelo menos 2 caracteres")
  .max(100, "Nome muito longo");

export const itemDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Descrição muito longa")
  .optional()
  .or(z.literal(""));

export const priceSchema = z
  .number()
  .positive("Preço deve ser positivo")
  .max(9999.99, "Preço muito alto");

// Search/Filter inputs (prevent SQL injection)
export const searchQuerySchema = z
  .string()
  .trim()
  .max(100, "Busca muito longa")
  .transform((val) => val.replace(/[<>'"%;()&+]/g, "")); // Remove dangerous chars

// UUID validation
export const uuidSchema = z.string().uuid("ID inválido");

// ========== Helper Functions ==========

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Prevent XSS
    .slice(0, 1000); // Limit length
}

export function sanitizeSearchQuery(input: string): string {
  return input
    .trim()
    .replace(/[<>'"%;()&+\\]/g, "") // Remove SQL injection chars
    .slice(0, 100);
}

// Validate and sanitize before database operations
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.errors[0].message);
  }
  return result.data;
}
