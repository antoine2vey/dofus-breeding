// AUTO-GENERATED color data (120 reproducible Muldo colors, Gen 1–10).
// Extracted + DAG-verified from dofuspourlesnoobs.com. Recipes are exact (canonical one per colour).
import type { ColorDef } from './colors.js'

export const MULDO_COLORS: ReadonlyArray<ColorDef> = [
  { name: 'Ebène', gen: 1, bonus: ['1 PM', '18% Résistance Air'], parents: null },
  { name: 'Indigo', gen: 1, bonus: ['1 PM', '18% Résistance Eau'], parents: null },
  { name: 'Pourpre', gen: 1, bonus: ['1 PM', '18% Résistance Terre'], parents: null },
  { name: 'Orchidée', gen: 1, bonus: ['1 PM', '18% Résistance Feu'], parents: null },
  { name: 'Doré', gen: 1, bonus: ['70 Puissance', '1 PM'], parents: null },
  {
    name: 'Doré et Pourpre',
    gen: 2,
    bonus: ['60 Puissance', '1 PM', '10% Résistance Terre'],
    parents: ['Doré', 'Pourpre']
  },
  {
    name: 'Indigo et Pourpre',
    gen: 2,
    bonus: ['1 PM', '10% Résistance Terre', '10% Résistance Eau'],
    parents: ['Indigo', 'Pourpre']
  },
  {
    name: 'Ebène et Pourpre',
    gen: 2,
    bonus: ['1 PM', '10% Résistance Terre', '10% Résistance Air'],
    parents: ['Ebène', 'Pourpre']
  },
  {
    name: 'Orchidée et Pourpre',
    gen: 2,
    bonus: ['1 PM', '10% Résistance Terre', '10% Résistance Feu'],
    parents: ['Orchidée', 'Pourpre']
  },
  {
    name: 'Doré et Orchidée',
    gen: 2,
    bonus: ['60 Puissance', '1 PM', '10% Résistance Feu'],
    parents: ['Doré', 'Orchidée']
  },
  {
    name: 'Indigo et Orchidée',
    gen: 2,
    bonus: ['1 PM', '10% Résistance Feu', '10% Résistance Eau'],
    parents: ['Indigo', 'Orchidée']
  },
  {
    name: 'Ebène et Orchidée',
    gen: 2,
    bonus: ['1 PM', '10% Résistance Feu', '10% Résistance Air'],
    parents: ['Ebène', 'Orchidée']
  },
  {
    name: 'Doré et Ebène',
    gen: 2,
    bonus: ['60 Puissance', '1 PM', '10% Résistance Air'],
    parents: ['Doré', 'Ebène']
  },
  {
    name: 'Doré et Indigo',
    gen: 2,
    bonus: ['60 Puissance', '1 PM', '10% Résistance Eau'],
    parents: ['Doré', 'Indigo']
  },
  {
    name: 'Ebène et Indigo',
    gen: 2,
    bonus: ['1 PM', '10% Résistance Eau', '10% Résistance Air'],
    parents: ['Ebène', 'Indigo']
  },
  {
    name: 'Roux',
    gen: 3,
    bonus: ['1 PM', '50 Tacle'],
    parents: ['Doré et Indigo', 'Doré et Pourpre']
  },
  {
    name: 'Amande',
    gen: 3,
    bonus: ['1 PM', '50 Fuite'],
    parents: ['Ebène et Orchidée', 'Indigo et Pourpre']
  },
  {
    name: 'Doré et Amande',
    gen: 4,
    bonus: ['60 Puissance', '1 PM', '40 Fuite'],
    parents: ['Amande', 'Doré']
  },
  {
    name: 'Ebène et Amande',
    gen: 4,
    bonus: ['1 PM', '10% Résistance Air', '40 Fuite'],
    parents: ['Amande', 'Ebène']
  },
  {
    name: 'Indigo et Amande',
    gen: 4,
    bonus: ['1 PM', '10% Résistance Eau', '40 Fuite'],
    parents: ['Amande', 'Indigo']
  },
  {
    name: 'Orchidée et Amande',
    gen: 4,
    bonus: ['1 PM', '10% Résistance Feu', '40 Fuite'],
    parents: ['Amande', 'Orchidée']
  },
  {
    name: 'Pourpre et Amande',
    gen: 4,
    bonus: ['1 PM', '10% Résistance Terre', '40 Fuite'],
    parents: ['Amande', 'Pourpre']
  },
  {
    name: 'Roux et Amande',
    gen: 4,
    bonus: ['1 PM', '40 Tacle', '40 Fuite'],
    parents: ['Amande', 'Roux']
  },
  {
    name: 'Roux et Doré',
    gen: 4,
    bonus: ['60 Puissance', '1 PM', '40 Tacle'],
    parents: ['Doré', 'Roux']
  },
  {
    name: 'Roux et Ebène',
    gen: 4,
    bonus: ['1 PM', '10% Résistance Air', '40 Tacle'],
    parents: ['Ebène', 'Roux']
  },
  {
    name: 'Roux et Indigo',
    gen: 4,
    bonus: ['1 PM', '10% Résistance Eau', '40 Tacle'],
    parents: ['Indigo', 'Roux']
  },
  {
    name: 'Roux et Orchidée',
    gen: 4,
    bonus: ['1 PM', '10% Résistance Feu', '40 Tacle'],
    parents: ['Orchidée', 'Roux']
  },
  {
    name: 'Roux et Pourpre',
    gen: 4,
    bonus: ['1 PM', '10% Résistance Terre', '40 Tacle'],
    parents: ['Pourpre', 'Roux']
  },
  {
    name: 'Ivoire',
    gen: 5,
    bonus: ['1 PM', '50 Esquive PA'],
    parents: ['Ebène et Amande', 'Roux et Doré']
  },
  {
    name: 'Turquoise',
    gen: 5,
    bonus: ['1 PM', '50 Esquive PM'],
    parents: ['Doré et Amande', 'Roux et Ebène']
  },
  {
    name: 'Pourpre et Ivoire',
    gen: 6,
    bonus: ['1 PM', '10% Résistance Terre', '40 Esquive PA'],
    parents: ['Ivoire', 'Pourpre']
  },
  {
    name: 'Orchidée et Ivoire',
    gen: 6,
    bonus: ['1 PM', '10% Résistance Feu', '40 Esquive PA'],
    parents: ['Ivoire', 'Orchidée']
  },
  {
    name: 'Indigo et Ivoire',
    gen: 6,
    bonus: ['1 PM', '10% Résistance Eau', '40 Esquive PA'],
    parents: ['Indigo', 'Ivoire']
  },
  {
    name: 'Ebène et Ivoire',
    gen: 6,
    bonus: ['1 PM', '10% Résistance Air', '40 Esquive PA'],
    parents: ['Ebène', 'Ivoire']
  },
  {
    name: 'Doré et Ivoire',
    gen: 6,
    bonus: ['60 Puissance', '1 PM', '40 Esquive PA'],
    parents: ['Doré', 'Ivoire']
  },
  {
    name: 'Roux et Ivoire',
    gen: 6,
    bonus: ['1 PM', '40 Tacle', '40 Esquive PA'],
    parents: ['Ivoire', 'Roux']
  },
  {
    name: 'Amande et Ivoire',
    gen: 6,
    bonus: ['1 PM', '40 Fuite', '40 Esquive PA'],
    parents: ['Amande', 'Ivoire']
  },
  {
    name: 'Turquoise et Ivoire',
    gen: 6,
    bonus: ['1 PM', '40 Esquive PA', '40 Esquive PM'],
    parents: ['Ivoire', 'Turquoise']
  },
  {
    name: 'Turquoise et Pourpre',
    gen: 6,
    bonus: ['1 PM', '10% Résistance Terre', '40 Esquive PM'],
    parents: ['Pourpre', 'Turquoise']
  },
  {
    name: 'Turquoise et Orchidée',
    gen: 6,
    bonus: ['1 PM', '10% Résistance Feu', '40 Esquive PM'],
    parents: ['Orchidée', 'Turquoise']
  },
  {
    name: 'Turquoise et Indigo',
    gen: 6,
    bonus: ['1 PM', '10% Résistance Eau', '40 Esquive PM'],
    parents: ['Indigo', 'Turquoise']
  },
  {
    name: 'Turquoise et Ebène',
    gen: 6,
    bonus: ['1 PM', '10% Résistance Air', '40 Esquive PM'],
    parents: ['Ebène', 'Turquoise']
  },
  {
    name: 'Turquoise et Roux',
    gen: 6,
    bonus: ['1 PM', '40 Tacle', '40 Esquive PM'],
    parents: ['Roux', 'Turquoise']
  },
  {
    name: 'Turquoise et Amande',
    gen: 6,
    bonus: ['1 PM', '40 Fuite', '40 Esquive PM'],
    parents: ['Amande', 'Turquoise']
  },
  {
    name: 'Turquoise et Doré',
    gen: 6,
    bonus: ['60 Puissance', '1 PM', '40 Esquive PM'],
    parents: ['Doré', 'Turquoise']
  },
  {
    name: 'Prune',
    gen: 7,
    bonus: ['12% Critique', '1 PM'],
    parents: ['Ebène et Ivoire', 'Turquoise et Pourpre']
  },
  {
    name: 'Emeraude',
    gen: 7,
    bonus: ['1 PM', '40 Dommages Critiques'],
    parents: ['Turquoise et Doré', 'Turquoise et Ivoire']
  },
  {
    name: 'Prune et Pourpre',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '10% Résistance Terre'],
    parents: ['Pourpre', 'Prune']
  },
  {
    name: 'Prune et Orchidée',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '10% Résistance Feu'],
    parents: ['Orchidée', 'Prune']
  },
  {
    name: 'Prune et Indigo',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '10% Résistance Eau'],
    parents: ['Indigo', 'Prune']
  },
  {
    name: 'Prune et Ebène',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '10% Résistance Air'],
    parents: ['Ebène', 'Prune']
  },
  {
    name: 'Prune et Doré',
    gen: 8,
    bonus: ['60 Puissance', '8% Critique', '1 PM'],
    parents: ['Doré', 'Prune']
  },
  {
    name: 'Prune et Roux',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '40 Tacle'],
    parents: ['Prune', 'Roux']
  },
  {
    name: 'Prune et Amande',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '40 Fuite'],
    parents: ['Amande', 'Prune']
  },
  {
    name: 'Prune et Ivoire',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '40 Esquive PA'],
    parents: ['Ivoire', 'Prune']
  },
  {
    name: 'Prune et Turquoise',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '40 Esquive PM'],
    parents: ['Prune', 'Turquoise']
  },
  {
    name: 'Prune et Emeraude',
    gen: 8,
    bonus: ['8% Critique', '1 PM', '30 Dommages Critiques'],
    parents: ['Prune', 'Emeraude']
  },
  {
    name: 'Pourpre et Emeraude',
    gen: 8,
    bonus: ['1 PM', '10% Résistance Terre', '30 Dommages Critiques'],
    parents: ['Pourpre', 'Emeraude']
  },
  {
    name: 'Orchidée et Emeraude',
    gen: 8,
    bonus: ['1 PM', '10% Résistance Feu', '30 Dommages Critiques'],
    parents: ['Orchidée', 'Emeraude']
  },
  {
    name: 'Indigo et Emeraude',
    gen: 8,
    bonus: ['1 PM', '10% Résistance Eau', '30 Dommages Critiques'],
    parents: ['Indigo', 'Emeraude']
  },
  {
    name: 'Ebène et Emeraude',
    gen: 8,
    bonus: ['1 PM', '10% Résistance Air', '30 Dommages Critiques'],
    parents: ['Ebène', 'Emeraude']
  },
  {
    name: 'Doré et Emeraude',
    gen: 8,
    bonus: ['60 Puissance', '1 PM', '30 Dommages Critiques'],
    parents: ['Doré', 'Emeraude']
  },
  {
    name: 'Roux et Emeraude',
    gen: 8,
    bonus: ['1 PM', '40 Tacle', '30 Dommages Critiques'],
    parents: ['Roux', 'Emeraude']
  },
  {
    name: 'Amande et Emeraude',
    gen: 8,
    bonus: ['1 PM', '40 Fuite', '30 Dommages Critiques'],
    parents: ['Amande', 'Emeraude']
  },
  {
    name: 'Ivoire et Emeraude',
    gen: 8,
    bonus: ['1 PM', '40 Esquive PA', '30 Dommages Critiques'],
    parents: ['Ivoire', 'Emeraude']
  },
  {
    name: 'Turquoise et Emeraude',
    gen: 8,
    bonus: ['1 PM', '40 Esquive PM', '30 Dommages Critiques'],
    parents: ['Turquoise', 'Emeraude']
  },
  {
    name: 'Ambre',
    gen: 9,
    bonus: ['1 PM', '40 Dommages Terre'],
    parents: ['Pourpre et Emeraude', 'Roux et Emeraude']
  },
  {
    name: 'Corail',
    gen: 9,
    bonus: ['1 PM', '40 Dommages Feu'],
    parents: ['Prune et Pourpre', 'Prune et Roux']
  },
  {
    name: 'Azur',
    gen: 9,
    bonus: ['1 PM', '40 Dommages Eau'],
    parents: ['Pourpre et Emeraude', 'Prune et Roux']
  },
  {
    name: 'Aigue-marine',
    gen: 9,
    bonus: ['1 PM', '40 Dommages Air'],
    parents: ['Prune et Pourpre', 'Roux et Emeraude']
  },
  {
    name: 'Ambre et Doré',
    gen: 10,
    bonus: ['60 Puissance', '1 PM', '30 Dommages Terre'],
    parents: ['Ambre', 'Doré']
  },
  {
    name: 'Ambre et Ebène',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '10% Résistance Air'],
    parents: ['Ambre', 'Ebène']
  },
  {
    name: 'Ambre et Indigo',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '10% Résistance Eau'],
    parents: ['Ambre', 'Indigo']
  },
  {
    name: 'Ambre et Pourpre',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '10% Résistance Terre'],
    parents: ['Ambre', 'Pourpre']
  },
  {
    name: 'Ambre et Orchidée',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '10% Résistance Feu'],
    parents: ['Ambre', 'Orchidée']
  },
  {
    name: 'Ambre et Amande',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '40 Fuite'],
    parents: ['Amande', 'Ambre']
  },
  {
    name: 'Ambre et Roux',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '40 Tacle'],
    parents: ['Ambre', 'Roux']
  },
  {
    name: 'Ambre et Ivoire',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '40 Esquive PA'],
    parents: ['Ambre', 'Ivoire']
  },
  {
    name: 'Ambre et Turquoise',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '40 Esquive PM'],
    parents: ['Ambre', 'Turquoise']
  },
  {
    name: 'Ambre et Emeraude',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '30 Dommages Critiques'],
    parents: ['Ambre', 'Emeraude']
  },
  {
    name: 'Ambre et Prune',
    gen: 10,
    bonus: ['8% Critique', '1 PM', '30 Dommages Terre'],
    parents: ['Ambre', 'Prune']
  },
  {
    name: 'Ambre et Corail',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '30 Dommages Feu'],
    parents: ['Ambre', 'Corail']
  },
  {
    name: 'Ambre et Azur',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '30 Dommages Eau'],
    parents: ['Ambre', 'Azur']
  },
  {
    name: 'Ambre et Aigue-marine',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Terre', '30 Dommages Air'],
    parents: ['Aigue-marine', 'Ambre']
  },
  {
    name: 'Corail et Doré',
    gen: 10,
    bonus: ['60 Puissance', '1 PM', '30 Dommages Feu'],
    parents: ['Corail', 'Doré']
  },
  {
    name: 'Corail et Ebène',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '10% Résistance Air'],
    parents: ['Corail', 'Ebène']
  },
  {
    name: 'Corail et Indigo',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '10% Résistance Eau'],
    parents: ['Corail', 'Indigo']
  },
  {
    name: 'Corail et Pourpre',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '10% Résistance Terre'],
    parents: ['Corail', 'Pourpre']
  },
  {
    name: 'Corail et Orchidée',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '10% Résistance Feu'],
    parents: ['Corail', 'Orchidée']
  },
  {
    name: 'Corail et Amande',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '40 Fuite'],
    parents: ['Amande', 'Corail']
  },
  {
    name: 'Corail et Roux',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '40 Tacle'],
    parents: ['Corail', 'Roux']
  },
  {
    name: 'Corail et Ivoire',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '40 Esquive PA'],
    parents: ['Corail', 'Ivoire']
  },
  {
    name: 'Corail et Turquoise',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '40 Esquive PM'],
    parents: ['Corail', 'Turquoise']
  },
  {
    name: 'Corail et Emeraude',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '30 Dommages Critiques'],
    parents: ['Corail', 'Emeraude']
  },
  {
    name: 'Corail et Prune',
    gen: 10,
    bonus: ['8% Critique', '1 PM', '30 Dommages Feu'],
    parents: ['Corail', 'Prune']
  },
  {
    name: 'Corail et Azur',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '30 Dommages Eau'],
    parents: ['Azur', 'Corail']
  },
  {
    name: 'Corail et Aigue-marine',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Feu', '30 Dommages Air'],
    parents: ['Aigue-marine', 'Corail']
  },
  {
    name: 'Azur et Doré',
    gen: 10,
    bonus: ['60 Puissance', '1 PM', '30 Dommages Eau'],
    parents: ['Azur', 'Doré']
  },
  {
    name: 'Azur et Ebène',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '10% Résistance Air'],
    parents: ['Azur', 'Ebène']
  },
  {
    name: 'Azur et Indigo',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '10% Résistance Eau'],
    parents: ['Azur', 'Indigo']
  },
  {
    name: 'Azur et Pourpre',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '10% Résistance Terre'],
    parents: ['Azur', 'Pourpre']
  },
  {
    name: 'Azur et Orchidée',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '10% Résistance Feu'],
    parents: ['Azur', 'Orchidée']
  },
  {
    name: 'Azur et Amande',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '40 Fuite'],
    parents: ['Amande', 'Azur']
  },
  {
    name: 'Azur et Roux',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '40 Tacle'],
    parents: ['Azur', 'Roux']
  },
  {
    name: 'Azur et Ivoire',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '40 Esquive PA'],
    parents: ['Azur', 'Ivoire']
  },
  {
    name: 'Azur et Turquoise',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '40 Esquive PM'],
    parents: ['Azur', 'Turquoise']
  },
  {
    name: 'Azur et Emeraude',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '30 Dommages Critiques'],
    parents: ['Azur', 'Emeraude']
  },
  {
    name: 'Azur et Prune',
    gen: 10,
    bonus: ['8% Critique', '1 PM', '30 Dommages Eau'],
    parents: ['Azur', 'Prune']
  },
  {
    name: 'Azur et Aigue-marine',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Eau', '30 Dommages Air'],
    parents: ['Aigue-marine', 'Azur']
  },
  {
    name: 'Aigue-marine et Doré',
    gen: 10,
    bonus: ['60 Puissance', '1 PM', '30 Dommages Air'],
    parents: ['Aigue-marine', 'Doré']
  },
  {
    name: 'Aigue-marine et Ebène',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '10% Résistance Air'],
    parents: ['Aigue-marine', 'Ebène']
  },
  {
    name: 'Aigue-marine et Indigo',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '10% Résistance Eau'],
    parents: ['Aigue-marine', 'Indigo']
  },
  {
    name: 'Aigue-marine et Pourpre',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '10% Résistance Terre'],
    parents: ['Aigue-marine', 'Pourpre']
  },
  {
    name: 'Aigue-marine et Orchidée',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '10% Résistance Feu'],
    parents: ['Aigue-marine', 'Orchidée']
  },
  {
    name: 'Aigue-marine et Amande',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '40 Fuite'],
    parents: ['Aigue-marine', 'Amande']
  },
  {
    name: 'Aigue-marine et Roux',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '40 Tacle'],
    parents: ['Aigue-marine', 'Roux']
  },
  {
    name: 'Aigue-marine et Ivoire',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '40 Esquive PA'],
    parents: ['Aigue-marine', 'Ivoire']
  },
  {
    name: 'Aigue-marine et Turquoise',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '40 Esquive PM'],
    parents: ['Aigue-marine', 'Turquoise']
  },
  {
    name: 'Aigue-marine et Emeraude',
    gen: 10,
    bonus: ['1 PM', '30 Dommages Air', '30 Dommages Critiques'],
    parents: ['Aigue-marine', 'Emeraude']
  },
  {
    name: 'Aigue-marine et Prune',
    gen: 10,
    bonus: ['8% Critique', '1 PM', '30 Dommages Air'],
    parents: ['Aigue-marine', 'Prune']
  }
]
