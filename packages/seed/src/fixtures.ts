import type { Room, Source } from '@roomsense/shared'

export const TERABEE_SOURCE = 'terabee-iothub-mock'
export const OUTLOOK_SOURCE = 'outlook-mock'

/**
 * 15 rooms across three real TU/e (Eindhoven University of Technology)
 * campus buildings. Room IDs use the actual TU/e `<floor>.<room>` numbering
 * format (e.g. Atlas 0.710 is the real PhD-defense hall). Building uses:
 *   Atlas    — main sustainable-education building (BREEAM "world's most
 *              sustainable education building"); high-rise floors 4-12.
 *   Flux     — Electrical Engineering / Applied Physics.
 *   Neuron   — EAISI (Eindhoven AI Systems Institute) + large lecture halls.
 *
 * Names mix Dutch, English, and international flavor (TU/e has 40%
 * international staff) — including the non-ASCII characters the test
 * convention requires (Curaçao, Höganäs, Café, Søren, Zoë).
 */
export const ROOMS: Room[] = [
  // Atlas — main building, education center
  { roomId: 'atlas-0.710', building: 'atlas', floor: 0, name: 'Senaatzaal (PhD defense hall)', capacity: 80, deviceId: 'TB-PCL-0001', outlookAddress: 'atlas-0.710@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'atlas-1.320', building: 'atlas', floor: 1, name: 'Vergaderzaal Höganäs', capacity: 12, deviceId: 'TB-PCL-0002', outlookAddress: 'atlas-1.320@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'atlas-2.910', building: 'atlas', floor: 2, name: 'Café Atlas Corner', capacity: 8, deviceId: 'TB-PCL-0003', outlookAddress: 'atlas-2.910@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'atlas-4.105', building: 'atlas', floor: 4, name: 'Zaal Curaçao', capacity: 6, deviceId: 'TB-PCL-0004', outlookAddress: 'atlas-4.105@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'atlas-6.220', building: 'atlas', floor: 6, name: 'Boardroom Hèlmholtz', capacity: 16, deviceId: 'TB-PCL-0005', outlookAddress: 'atlas-6.220@tue.nl', sourceId: TERABEE_SOURCE },

  // Flux — Electrical Engineering / Applied Physics
  { roomId: 'flux-1.02', building: 'flux', floor: 1, name: 'Brainstorm Lounge Flux', capacity: 10, deviceId: 'TB-PCL-0006', outlookAddress: 'flux-1.02@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-1.05', building: 'flux', floor: 1, name: 'Projectkamer Maxwell', capacity: 6, deviceId: 'TB-PCL-0007', outlookAddress: 'flux-1.05@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-3.98', building: 'flux', floor: 3, name: 'Focus Cabin Zoë', capacity: 2, deviceId: 'TB-PCL-0008', outlookAddress: 'flux-3.98@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-4.20', building: 'flux', floor: 4, name: 'EH DR. meeting (EE research)', capacity: 8, deviceId: 'TB-PCL-0009', outlookAddress: 'flux-4.20@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-5.04', building: 'flux', floor: 5, name: 'Auditorium Faraday', capacity: 24, deviceId: 'TB-PCL-0010', outlookAddress: 'flux-5.04@tue.nl', sourceId: TERABEE_SOURCE },

  // Neuron — EAISI / education
  { roomId: 'neuron-0.140', building: 'neuron', floor: 0, name: 'EAISI Lab Overleg', capacity: 6, deviceId: 'TB-PCL-0011', outlookAddress: 'neuron-0.140@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-1.16', building: 'neuron', floor: 1, name: 'Zaal Gödel', capacity: 10, deviceId: 'TB-PCL-0012', outlookAddress: 'neuron-1.16@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-2.22', building: 'neuron', floor: 2, name: 'Scrumhoek Søren', capacity: 5, deviceId: 'TB-PCL-0013', outlookAddress: 'neuron-2.22@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-3.10', building: 'neuron', floor: 3, name: 'Denktank EAISI', capacity: 8, deviceId: 'TB-PCL-0014', outlookAddress: 'neuron-3.10@tue.nl', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-3.14', building: 'neuron', floor: 3, name: 'Stiltecabine Faaborg', capacity: 4, deviceId: 'TB-PCL-0015', outlookAddress: 'neuron-3.14@tue.nl', sourceId: TERABEE_SOURCE },
]

/**
 * Realistic organizer mix: Dutch names, international researchers, and a
 * couple of explicit non-ASCII names (the standing test convention).
 */
export const ORGANIZERS = [
  'Sanne de Vries',
  'Bram Willems',
  'Femke van den Berg',
  'Jörgen Månsson',
  'Anaïs Dubois',
  'Tomás Núñez',
  'Ingrid Sørensen',
  'Mikkel Østergaard',
  'Wei Chen',
  'Priya Iyer',
  'Pieter-Jan Verhoeven',
]

/**
 * Realistic TU/e meeting subjects (Dutch + English mix, matching actual
 * staff usage). International faculty meetings + Dutch department business.
 */
export const SUBJECTS = [
  'Sprint review',
  'Kwartaalreview',
  'PhD supervision 1:1',
  'Projectoverleg',
  'Design critique',
  'Budget alignment',
  'Stand-up (uitloop)',
  'EAISI research seminar',
  'Kennissessie',
  'Sollicitatiegesprek',
  'BEP mid-term review',
  'Grant kickoff (NWO/TOPSIS)',
  'Qualifying exam',
  'Quarterly with industry partner',
]

export function buildSources(nowIso: string): Source[] {
  return [
    { sourceId: TERABEE_SOURCE, displayName: 'Terabee People Counting (IoT Hub mock)', kind: 'sensor', status: 'active', lastSyncTs: nowIso },
    { sourceId: OUTLOOK_SOURCE, displayName: 'Outlook rooms & reservations (mock)', kind: 'calendar', status: 'active', lastSyncTs: nowIso },
  ]
}
