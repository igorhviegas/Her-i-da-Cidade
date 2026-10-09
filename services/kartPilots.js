// Pilotos inscritos no Campeonato Viegas Kart (vindos do Notion). `aliases` = outras grafias do nome no relatório de cronometragem
// além do próprio nome (o casamento exige todos os termos do nome dentro do nome completo do PDF, ver kart.js).
import { norm } from './kart.js';

export const pilotId = (name) => norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const NAMES = [
  'Igor Viegas', 'Vitor Mancio', 'Fabrício Viegas', 'Fabiano Viegas', 'Lemuel', 'Larissa Reis', 'Mateus de Rezende', 'Juliano Viegas',
  'Hugo Viegas', 'Petrus', 'Arthur Marra', 'Luiz Guilherme', 'Yann Handel', 'Cibelle Luiza', 'Flavio Henrique', 'Gerson',
  'Arthur Montandon', 'Adany', 'Iago Rodrigues', 'Mateus Botacin', 'Henrique Reis', 'Lilia Mansor', 'Iago Corradi', 'Julia Ribeiro',
  'Isaías Luiz', 'Patricia Mariana', 'Thais Viegas', 'Gabriel Valim', 'Guilherme Gomes', 'Raphael Thalles', 'Charliston David',
  'Lorrany Valim', 'Luis Ramos', 'Leandro Lara', 'Vander Jr', 'Cayo Gabriel', 'Byanca Mansor', 'Icaro Mansor',
];
const ALIASES = { 'Vander Jr': ['Vander Junior'] };

export const DEFAULT_KART_PILOTS = NAMES.map((name) => ({ id: pilotId(name), name, aliases: ALIASES[name] ?? [], active: true }));
