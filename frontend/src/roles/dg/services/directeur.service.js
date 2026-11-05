import { directeurMock } from '../data/directeur.mock';

// Contrat préparé pour la future intégration UPYA.
// En production, remplacer USE_MOCKS par false et brancher l'API réelle.
const USE_MOCKS = true;
export const DIRECTEUR_ENDPOINT = '/directeur';

export async function getDirecteurDashboard() {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return directeurMock;
  }

  const response = await fetch(DIRECTEUR_ENDPOINT, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Erreur API directeur : ${response.status}`);
  }

  return response.json();
}
