export function requestActions(role, status) {
  const actions = [];
  if (role === "am" && status === "PROPOSED")
    actions.push(["edit", "Modifier"], ["cancel", "Annuler"]);
  if (role === "commercial" && status === "PROPOSED")
    actions.push(["review", "Vérifier"], ["cancel", "Annuler"]);
  if (role === "commercial" && status === "SUBMITTED")
    actions.push(["cancel", "Annuler"]);
  if (role === "supply" && status === "SUBMITTED")
    actions.push(["review", "Traiter"]);
  if (role === "supply" && status === "APPROVED")
    actions.push(["prepare", "Préparer"], ["cancel", "Annuler"]);
  if (role === "supply" && status === "PREPARED")
    actions.push(["dispatch", "Expédier"], ["cancel", "Annuler"]);
  if (role === "am" && status === "SHIPPED")
    actions.push(["receive", "Confirmer la réception"]);
  if (role === "supply" && status === "DISPUTED")
    actions.push(["resolve", "Résoudre l’écart"]);
  return actions;
}
