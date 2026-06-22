// AUTO-GENERATED color data (120 reproducible Volkorne colors, Gen 1–10).
// Extracted + DAG-verified from dofuspourlesnoobs.com. Recipes are exact (canonical one per colour).
import type { ColorDef } from './colors.js'

export const VOLKORNE_COLORS: ReadonlyArray<ColorDef> = [
  { name: 'Ebène', gen: 1, bonus: [], parents: null },
  { name: 'Indigo', gen: 1, bonus: [], parents: null },
  { name: 'Pourpre', gen: 1, bonus: [], parents: null },
  { name: 'Orchidée', gen: 1, bonus: [], parents: null },
  {
    name: 'Pourpre et Orchidée',
    gen: 2,
    bonus: ['70 Force', '70 Intelligence', '1 PA'],
    parents: ['Pourpre', 'Orchidée']
  },
  {
    name: 'Pourpre et Indigo',
    gen: 2,
    bonus: ['70 Force', '70 Chance', '1 PA'],
    parents: ['Pourpre', 'Indigo']
  },
  {
    name: 'Pourpre et Ebène',
    gen: 2,
    bonus: ['70 Force', '70 Agilité', '1 PA'],
    parents: ['Pourpre', 'Ebène']
  },
  {
    name: 'Orchidée et Indigo',
    gen: 2,
    bonus: ['70 Intelligence', '70 Chance', '1 PA'],
    parents: ['Orchidée', 'Indigo']
  },
  {
    name: 'Orchidée et Ebène',
    gen: 2,
    bonus: ['70 Intelligence', '70 Agilité', '1 PA'],
    parents: ['Orchidée', 'Ebène']
  },
  {
    name: 'Indigo et Ebène',
    gen: 2,
    bonus: ['70 Chance', '70 Agilité', '1 PA'],
    parents: ['Indigo', 'Ebène']
  },
  {
    name: 'Roux',
    gen: 3,
    bonus: ['1 PA', '70 Dommages Poussée'],
    parents: ['Pourpre et Ebène', 'Pourpre et Indigo']
  },
  {
    name: 'Amande',
    gen: 3,
    bonus: ['1 PA', '90 Résistances Poussée'],
    parents: ['Indigo et Ebène', 'Orchidée et Ebène']
  },
  {
    name: 'Ivoire',
    gen: 3,
    bonus: ['1 PA', '40 Retrait PA'],
    parents: ['Indigo et Ebène', 'Orchidée et Indigo']
  },
  {
    name: 'Turquoise',
    gen: 3,
    bonus: ['1 PA', '40 Retrait PM'],
    parents: ['Orchidée et Ebène', 'Orchidée et Indigo']
  },
  {
    name: 'Amande et Pourpre',
    gen: 4,
    bonus: ['70 Force', '1 PA', '70 Résistances Poussée'],
    parents: ['Amande', 'Pourpre']
  },
  {
    name: 'Amande et Orchidée',
    gen: 4,
    bonus: ['70 Intelligence', '1 PA', '70 Résistances Poussée'],
    parents: ['Amande', 'Orchidée']
  },
  {
    name: 'Amande et Indigo',
    gen: 4,
    bonus: ['70 Chance', '1 PA', '70 Résistances Poussée'],
    parents: ['Amande', 'Indigo']
  },
  {
    name: 'Amande et Ebène',
    gen: 4,
    bonus: ['70 Agilité', '1 PA', '70 Résistances Poussée'],
    parents: ['Amande', 'Ebène']
  },
  {
    name: 'Amande et Roux',
    gen: 4,
    bonus: ['1 PA', '50 Dommages Poussée', '70 Résistances Poussée'],
    parents: ['Amande', 'Roux']
  },
  {
    name: 'Amande et Ivoire',
    gen: 4,
    bonus: ['1 PA', '30 Retrait PA', '70 Résistances Poussée'],
    parents: ['Amande', 'Ivoire']
  },
  {
    name: 'Amande et Turquoise',
    gen: 4,
    bonus: ['1 PA', '30 Retrait PM', '70 Résistances Poussée'],
    parents: ['Amande', 'Turquoise']
  },
  {
    name: 'Roux et Pourpre',
    gen: 4,
    bonus: ['70 Force', '1 PA', '50 Dommages Poussée'],
    parents: ['Roux', 'Pourpre']
  },
  {
    name: 'Roux et Orchidée',
    gen: 4,
    bonus: ['70 Intelligence', '1 PA', '50 Dommages Poussée'],
    parents: ['Roux', 'Orchidée']
  },
  {
    name: 'Roux et Indigo',
    gen: 4,
    bonus: ['70 Chance', '1 PA', '50 Dommages Poussée'],
    parents: ['Roux', 'Indigo']
  },
  {
    name: 'Roux et Ebène',
    gen: 4,
    bonus: ['70 Agilité', '1 PA', '50 Dommages Poussée'],
    parents: ['Roux', 'Ebène']
  },
  {
    name: 'Roux et Ivoire',
    gen: 4,
    bonus: ['1 PA', '30 Retrait PA', '50 Dommages Poussée'],
    parents: ['Roux', 'Ivoire']
  },
  {
    name: 'Roux et Turquoise',
    gen: 4,
    bonus: ['1 PA', '30 Retrait PM', '50 Dommages Poussée'],
    parents: ['Roux', 'Turquoise']
  },
  {
    name: 'Ivoire et Pourpre',
    gen: 4,
    bonus: ['70 Force', '1 PA', '30 Retrait PA'],
    parents: ['Ivoire', 'Pourpre']
  },
  {
    name: 'Ivoire et Orchidée',
    gen: 4,
    bonus: ['70 Intelligence', '1 PA', '30 Retrait PA'],
    parents: ['Ivoire', 'Orchidée']
  },
  {
    name: 'Ivoire et Indigo',
    gen: 4,
    bonus: ['70 Chance', '1 PA', '30 Retrait PA'],
    parents: ['Ivoire', 'Indigo']
  },
  {
    name: 'Ivoire et Ebène',
    gen: 4,
    bonus: ['70 Agilité', '1 PA', '30 Retrait PA'],
    parents: ['Ivoire', 'Ebène']
  },
  {
    name: 'Ivoire et Turquoise',
    gen: 4,
    bonus: ['1 PA', '30 Retrait PA', '30 Retrait PM'],
    parents: ['Ivoire', 'Turquoise']
  },
  {
    name: 'Turquoise et Pourpre',
    gen: 4,
    bonus: ['70 Force', '1 PA', '30 Retrait PM'],
    parents: ['Turquoise', 'Pourpre']
  },
  {
    name: 'Turquoise et Orchidée',
    gen: 4,
    bonus: ['70 Intelligence', '1 PA', '30 Retrait PM'],
    parents: ['Turquoise', 'Orchidée']
  },
  {
    name: 'Turquoise et Indigo',
    gen: 4,
    bonus: ['70 Chance', '1 PA', '30 Retrait PM'],
    parents: ['Turquoise', 'Indigo']
  },
  {
    name: 'Turquoise et Ebène',
    gen: 4,
    bonus: ['70 Agilité', '1 PA', '30 Retrait PM'],
    parents: ['Turquoise', 'Ebène']
  },
  {
    name: 'Prune',
    gen: 5,
    bonus: ['1 PA', '60 Résistances Critiques'],
    parents: ['Amande et Ebène', 'Amande et Roux']
  },
  {
    name: 'Emeraude',
    gen: 5,
    bonus: ['9% Critique', '1 PA'],
    parents: ['Amande et Ivoire', 'Ivoire et Turquoise']
  },
  {
    name: 'Prune et Pourpre',
    gen: 6,
    bonus: ['70 Force', '1 PA', '45 Résistances Critiques'],
    parents: ['Prune', 'Pourpre']
  },
  {
    name: 'Prune et Orchidée',
    gen: 6,
    bonus: ['70 Intelligence', '1 PA', '45 Résistances Critiques'],
    parents: ['Prune', 'Orchidée']
  },
  {
    name: 'Prune et Indigo',
    gen: 6,
    bonus: ['70 Chance', '1 PA', '45 Résistances Critiques'],
    parents: ['Prune', 'Indigo']
  },
  {
    name: 'Prune et Ebène',
    gen: 6,
    bonus: ['70 Agilité', '1 PA', '45 Résistances Critiques'],
    parents: ['Prune', 'Ebène']
  },
  {
    name: 'Prune et Amande',
    gen: 6,
    bonus: ['1 PA', '45 Résistances Critiques', '70 Résistances Poussée'],
    parents: ['Prune', 'Amande']
  },
  {
    name: 'Prune et Roux',
    gen: 6,
    bonus: ['1 PA', '45 Résistances Critiques', '50 Dommages Poussée'],
    parents: ['Prune', 'Roux']
  },
  {
    name: 'Prune et Ivoire',
    gen: 6,
    bonus: ['1 PA', '30 Retrait PA', '45 Résistances Critiques'],
    parents: ['Prune', 'Ivoire']
  },
  {
    name: 'Prune et Turquoise',
    gen: 6,
    bonus: ['1 PA', '30 Retrait PM', '45 Résistances Critiques'],
    parents: ['Prune', 'Turquoise']
  },
  {
    name: 'Prune et Emeraude',
    gen: 6,
    bonus: ['7% Critique', '1 PA', '45 Résistances Critiques'],
    parents: ['Prune', 'Emeraude']
  },
  {
    name: 'Emeraude et Pourpre',
    gen: 6,
    bonus: ['70 Force', '7% Critique', '1 PA'],
    parents: ['Emeraude', 'Pourpre']
  },
  {
    name: 'Emeraude et Orchidée',
    gen: 6,
    bonus: ['70 Intelligence', '7% Critique', '1 PA'],
    parents: ['Emeraude', 'Orchidée']
  },
  {
    name: 'Emeraude et Indigo',
    gen: 6,
    bonus: ['70 Chance', '7% Critique', '1 PA'],
    parents: ['Emeraude', 'Indigo']
  },
  {
    name: 'Emeraude et Ebène',
    gen: 6,
    bonus: ['70 Agilité', '7% Critique', '1 PA'],
    parents: ['Emeraude', 'Ebène']
  },
  {
    name: 'Emeraude et Amande',
    gen: 6,
    bonus: ['7% Critique', '1 PA', '70 Résistances Poussée'],
    parents: ['Emeraude', 'Amande']
  },
  {
    name: 'Emeraude et Roux',
    gen: 6,
    bonus: ['7% Critique', '1 PA', '50 Dommages Poussée'],
    parents: ['Emeraude', 'Roux']
  },
  {
    name: 'Emeraude et Ivoire',
    gen: 6,
    bonus: ['7% Critique', '1 PA', '30 Retrait PA'],
    parents: ['Emeraude', 'Ivoire']
  },
  {
    name: 'Emeraude et Turquoise',
    gen: 6,
    bonus: ['7% Critique', '1 PA', '30 Retrait PM'],
    parents: ['Emeraude', 'Turquoise']
  },
  {
    name: 'Doré',
    gen: 7,
    bonus: ['250 Vitalité', '1 PA'],
    parents: ['Emeraude et Amande', 'Prune et Ebène']
  },
  {
    name: 'Doré et Pourpre',
    gen: 8,
    bonus: ['200 Vitalité', '70 Force', '1 PA'],
    parents: ['Doré', 'Pourpre']
  },
  {
    name: 'Doré et Orchidée',
    gen: 8,
    bonus: ['200 Vitalité', '70 Intelligence', '1 PA'],
    parents: ['Doré', 'Orchidée']
  },
  {
    name: 'Doré et Indigo',
    gen: 8,
    bonus: ['200 Vitalité', '70 Chance', '1 PA'],
    parents: ['Doré', 'Indigo']
  },
  {
    name: 'Doré et Ebène',
    gen: 8,
    bonus: ['200 Vitalité', '70 Agilité', '1 PA'],
    parents: ['Doré', 'Ebène']
  },
  {
    name: 'Doré et Roux',
    gen: 8,
    bonus: ['200 Vitalité', '50 Dommages Poussée', '1 PA'],
    parents: ['Doré', 'Roux']
  },
  {
    name: 'Doré et Amande',
    gen: 8,
    bonus: ['200 Vitalité', '70 Résistances Poussée', '1 PA'],
    parents: ['Doré', 'Amande']
  },
  {
    name: 'Doré et Ivoire',
    gen: 8,
    bonus: ['200 Vitalité', '30 Retrait PA', '1 PA'],
    parents: ['Doré', 'Ivoire']
  },
  {
    name: 'Doré et Turquoise',
    gen: 8,
    bonus: ['200 Vitalité', '30 Retrait PM', '1 PA'],
    parents: ['Doré', 'Turquoise']
  },
  {
    name: 'Doré et Prune',
    gen: 8,
    bonus: ['200 Vitalité', '45 Résistances Critiques', '1 PA'],
    parents: ['Doré', 'Prune']
  },
  {
    name: 'Doré et Emeraude',
    gen: 8,
    bonus: ['200 Vitalité', '7% Critique', '1 PA'],
    parents: ['Doré', 'Emeraude']
  },
  {
    name: 'Jade',
    gen: 9,
    bonus: ['1 PA', '14% Résistance Terre'],
    parents: ['Doré et Pourpre', 'Prune et Emeraude']
  },
  {
    name: 'Rubis',
    gen: 9,
    bonus: ['1 PA', '14% Résistance Feu'],
    parents: ['Doré et Orchidée', 'Prune et Emeraude']
  },
  {
    name: 'Saphir',
    gen: 9,
    bonus: ['1 PA', '14% Résistance Eau'],
    parents: ['Doré et Indigo', 'Prune et Emeraude']
  },
  {
    name: 'Améthyste',
    gen: 9,
    bonus: ['1 PA', '14% Résistance Air'],
    parents: ['Doré et Ebène', 'Prune et Emeraude']
  },
  {
    name: 'Jade et Pourpre',
    gen: 10,
    bonus: ['70 Force', '1 PA', '8% Résistance Terre'],
    parents: ['Jade', 'Pourpre']
  },
  {
    name: 'Jade et Orchidée',
    gen: 10,
    bonus: ['70 Intelligence', '1 PA', '8% Résistance Terre'],
    parents: ['Jade', 'Orchidée']
  },
  {
    name: 'Jade et Indigo',
    gen: 10,
    bonus: ['70 Chance', '1 PA', '8% Résistance Terre'],
    parents: ['Jade', 'Indigo']
  },
  {
    name: 'Jade et Ebène',
    gen: 10,
    bonus: ['70 Agilité', '1 PA', '8% Résistance Terre'],
    parents: ['Jade', 'Ebène']
  },
  {
    name: 'Jade et Amande',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Terre', '70 Résistances Poussée'],
    parents: ['Jade', 'Amande']
  },
  {
    name: 'Jade et Roux',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Terre', '50 Dommages Poussée'],
    parents: ['Jade', 'Roux']
  },
  {
    name: 'Jade et Ivoire',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Terre', '30 Retrait PA'],
    parents: ['Jade', 'Ivoire']
  },
  {
    name: 'Jade et Turquoise',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Terre', '30 Retrait PM'],
    parents: ['Jade', 'Turquoise']
  },
  {
    name: 'Jade et Prune',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Terre', '45 Résistances Critiques'],
    parents: ['Jade', 'Prune']
  },
  {
    name: 'Jade et Emeraude',
    gen: 10,
    bonus: ['7% Critique', '1 PA', '8% Résistance Terre'],
    parents: ['Jade', 'Emeraude']
  },
  {
    name: 'Jade et Doré',
    gen: 10,
    bonus: ['200 Vitalité', '1 PA', '8% Résistance Terre'],
    parents: ['Jade', 'Doré']
  },
  {
    name: 'Jade et Rubis',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Terre', '8% Résistance Feu'],
    parents: ['Jade', 'Rubis']
  },
  {
    name: 'Jade et Saphir',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Terre', '8% Résistance Eau'],
    parents: ['Jade', 'Saphir']
  },
  {
    name: 'Jade et Améthyste',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Terre', '8% Résistance Air'],
    parents: ['Jade', 'Améthyste']
  },
  {
    name: 'Rubis et Pourpre',
    gen: 10,
    bonus: ['70 Force', '1 PA', '8% Résistance Feu'],
    parents: ['Rubis', 'Pourpre']
  },
  {
    name: 'Rubis et Orchidée',
    gen: 10,
    bonus: ['70 Intelligence', '1 PA', '8% Résistance Feu'],
    parents: ['Rubis', 'Orchidée']
  },
  {
    name: 'Rubis et Indigo',
    gen: 10,
    bonus: ['70 Chance', '1 PA', '8% Résistance Feu'],
    parents: ['Rubis', 'Indigo']
  },
  {
    name: 'Rubis et Ebène',
    gen: 10,
    bonus: ['70 Agilité', '1 PA', '8% Résistance Feu'],
    parents: ['Rubis', 'Ebène']
  },
  {
    name: 'Rubis et Amande',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Feu', '70 Résistances Poussée'],
    parents: ['Rubis', 'Amande']
  },
  {
    name: 'Rubis et Roux',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Feu', '50 Dommages Poussée'],
    parents: ['Rubis', 'Roux']
  },
  {
    name: 'Rubis et Ivoire',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Feu', '30 Retrait PA'],
    parents: ['Rubis', 'Ivoire']
  },
  {
    name: 'Rubis et Turquoise',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Feu', '30 Retrait PM'],
    parents: ['Rubis', 'Turquoise']
  },
  {
    name: 'Rubis et Prune',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Feu', '45 Résistances Critiques'],
    parents: ['Rubis', 'Prune']
  },
  {
    name: 'Rubis et Emeraude',
    gen: 10,
    bonus: ['7% Critique', '1 PA', '8% Résistance Feu'],
    parents: ['Rubis', 'Emeraude']
  },
  {
    name: 'Rubis et Doré',
    gen: 10,
    bonus: ['200 Vitalité', '1 PA', '8% Résistance Feu'],
    parents: ['Rubis', 'Doré']
  },
  {
    name: 'Rubis et Saphir',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Feu', '8% Résistance Eau'],
    parents: ['Rubis', 'Saphir']
  },
  {
    name: 'Rubis et Améthyste',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Feu', '8% Résistance Air'],
    parents: ['Rubis', 'Améthyste']
  },
  {
    name: 'Saphir et Pourpre',
    gen: 10,
    bonus: ['70 Force', '1 PA', '8% Résistance Eau'],
    parents: ['Saphir', 'Pourpre']
  },
  {
    name: 'Saphir et Orchidée',
    gen: 10,
    bonus: ['70 Intelligence', '1 PA', '8% Résistance Eau'],
    parents: ['Saphir', 'Orchidée']
  },
  {
    name: 'Saphir et Indigo',
    gen: 10,
    bonus: ['70 Chance', '1 PA', '8% Résistance Eau'],
    parents: ['Saphir', 'Indigo']
  },
  {
    name: 'Saphir et Ebène',
    gen: 10,
    bonus: ['70 Agilité', '1 PA', '8% Résistance Eau'],
    parents: ['Saphir', 'Ebène']
  },
  {
    name: 'Saphir et Amande',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Eau', '70 Résistances Poussée'],
    parents: ['Saphir', 'Amande']
  },
  {
    name: 'Saphir et Roux',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Eau', '50 Dommages Poussée'],
    parents: ['Saphir', 'Roux']
  },
  {
    name: 'Saphir et Ivoire',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Eau', '30 Retrait PA'],
    parents: ['Saphir', 'Ivoire']
  },
  {
    name: 'Saphir et Turquoise',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Eau', '30 Retrait PM'],
    parents: ['Saphir', 'Turquoise']
  },
  {
    name: 'Saphir et Prune',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Eau', '45 Résistances Critiques'],
    parents: ['Saphir', 'Prune']
  },
  {
    name: 'Saphir et Emeraude',
    gen: 10,
    bonus: ['7% Critique', '1 PA', '8% Résistance Eau'],
    parents: ['Saphir', 'Emeraude']
  },
  {
    name: 'Saphir et Doré',
    gen: 10,
    bonus: ['200 Vitalité', '1 PA', '8% Résistance Eau'],
    parents: ['Saphir', 'Doré']
  },
  {
    name: 'Saphir et Améthyste',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Eau', '8% Résistance Air'],
    parents: ['Saphir', 'Améthyste']
  },
  {
    name: 'Améthyste et Pourpre',
    gen: 10,
    bonus: ['70 Force', '1 PA', '8% Résistance Air'],
    parents: ['Améthyste', 'Pourpre']
  },
  {
    name: 'Améthyste et Orchidée',
    gen: 10,
    bonus: ['70 Intelligence', '1 PA', '8% Résistance Air'],
    parents: ['Améthyste', 'Orchidée']
  },
  {
    name: 'Améthyste et Indigo',
    gen: 10,
    bonus: ['70 Chance', '1 PA', '8% Résistance Air'],
    parents: ['Améthyste', 'Indigo']
  },
  {
    name: 'Améthyste et Ebène',
    gen: 10,
    bonus: ['70 Agilité', '1 PA', '8% Résistance Air'],
    parents: ['Améthyste', 'Ebène']
  },
  {
    name: 'Améthyste et Amande',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Air', '70 Résistances Poussée'],
    parents: ['Améthyste', 'Amande']
  },
  {
    name: 'Améthyste et Roux',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Air', '50 Dommages Poussée'],
    parents: ['Améthyste', 'Roux']
  },
  {
    name: 'Améthyste et Ivoire',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Air', '30 Retrait PA'],
    parents: ['Améthyste', 'Ivoire']
  },
  {
    name: 'Améthyste et Turquoise',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Air', '30 Retrait PM'],
    parents: ['Améthyste', 'Turquoise']
  },
  {
    name: 'Améthyste et Prune',
    gen: 10,
    bonus: ['1 PA', '8% Résistance Air', '45 Résistances Critiques'],
    parents: ['Améthyste', 'Prune']
  },
  {
    name: 'Améthyste et Emeraude',
    gen: 10,
    bonus: ['7% Critique', '1 PA', '8% Résistance Air'],
    parents: ['Améthyste', 'Emeraude']
  },
  {
    name: 'Améthyste et Doré',
    gen: 10,
    bonus: ['200 Vitalité', '1 PA', '8% Résistance Air'],
    parents: ['Améthyste', 'Doré']
  }
]
