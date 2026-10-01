/** Prazos em dias corridos; mantém a hora local do pagamento. */
export function calculateOrderDeadlines(paidAt: Date, deliveryDays: number): { customerDueDate: Date; internalDueDate: Date } {
  if (!(paidAt instanceof Date) || Number.isNaN(paidAt.getTime())) throw new Error("Data de pagamento inválida.");
  if (!Number.isInteger(deliveryDays) || deliveryDays < 0) throw new Error("O prazo deve ser um número inteiro de dias corridos.");
  const customerDueDate = new Date(paidAt);
  customerDueDate.setDate(customerDueDate.getDate() + deliveryDays);
  const internalDueDate = new Date(customerDueDate);
  internalDueDate.setDate(internalDueDate.getDate() - 1);
  return { customerDueDate, internalDueDate };
}
