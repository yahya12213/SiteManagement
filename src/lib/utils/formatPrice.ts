/**
 * Formate un prix pour l'affichage
 * Gère les types number, string et undefined de manière sécurisée
 *
 * @param price - Le prix à formater (peut être number, string ou undefined)
 * @param currency - La devise à afficher (par défaut: "MAD")
 * @returns Le prix formaté avec 2 décimales ou "Gratuit" si 0/null/undefined
 */
export function formatPrice(
  price: number | string | null | undefined,
  currency: string = 'MAD'
): string {
  // Gérer les cas null/undefined
  if (price === null || price === undefined) {
    return 'Gratuit';
  }

  // Convertir en number si c'est une string
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;

  // Vérifier si la conversion a échoué
  if (isNaN(numericPrice)) {
    return 'Gratuit';
  }

  // Si le prix est 0 ou négatif
  if (numericPrice <= 0) {
    return 'Gratuit';
  }

  // Formater avec 2 décimales
  return `${numericPrice.toFixed(2)} ${currency}`;
}
