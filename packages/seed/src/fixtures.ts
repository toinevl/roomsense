import type { Room, Source } from '@roomsense/shared'

export const TERABEE_SOURCE = 'terabee-iothub-mock'
export const OUTLOOK_SOURCE = 'outlook-mock'

/**
 * 15 fictional rooms across three buildings. Names deliberately include
 * non-ASCII characters — the standing testing convention: real room data
 * is never ASCII-only, so fixtures must not be either.
 */
export const ROOMS: Room[] = [
  { roomId: 'atlas-2-210', building: 'atlas', floor: 2, name: 'Vergaderzaal Höganäs', capacity: 8, deviceId: 'TB-PCL-0001', outlookAddress: 'atlas-2-210@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'atlas-2-215', building: 'atlas', floor: 2, name: 'Zaal Curaçao', capacity: 12, deviceId: 'TB-PCL-0002', outlookAddress: 'atlas-2-215@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'atlas-4-410', building: 'atlas', floor: 4, name: 'Café Corner', capacity: 6, deviceId: 'TB-PCL-0003', outlookAddress: 'atlas-4-410@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'atlas-4-420', building: 'atlas', floor: 4, name: 'Studio Malmö', capacity: 4, deviceId: 'TB-PCL-0004', outlookAddress: 'atlas-4-420@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'atlas-5-501', building: 'atlas', floor: 5, name: 'Boardroom Ørsted', capacity: 16, deviceId: 'TB-PCL-0005', outlookAddress: 'atlas-5-501@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-1-101', building: 'flux', floor: 1, name: 'Brainstorm Lounge', capacity: 10, deviceId: 'TB-PCL-0006', outlookAddress: 'flux-1-101@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-1-105', building: 'flux', floor: 1, name: 'Zaal Skagerrak', capacity: 6, deviceId: 'TB-PCL-0007', outlookAddress: 'flux-1-105@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-2-201', building: 'flux', floor: 2, name: 'Projectkamer Süd', capacity: 8, deviceId: 'TB-PCL-0008', outlookAddress: 'flux-2-201@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-2-207', building: 'flux', floor: 2, name: 'Focus Booth Åse', capacity: 2, deviceId: 'TB-PCL-0009', outlookAddress: 'flux-2-207@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'flux-3-301', building: 'flux', floor: 3, name: 'Auditorium Klein', capacity: 24, deviceId: 'TB-PCL-0010', outlookAddress: 'flux-3-301@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-1-110', building: 'neuron', floor: 1, name: 'Lab Overleg 1', capacity: 6, deviceId: 'TB-PCL-0011', outlookAddress: 'neuron-1-110@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-1-115', building: 'neuron', floor: 1, name: 'Zaal Genève', capacity: 10, deviceId: 'TB-PCL-0012', outlookAddress: 'neuron-1-115@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-2-220', building: 'neuron', floor: 2, name: 'Scrumhoek Björn', capacity: 5, deviceId: 'TB-PCL-0013', outlookAddress: 'neuron-2-220@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-3-330', building: 'neuron', floor: 3, name: 'Denktank Zócalo', capacity: 8, deviceId: 'TB-PCL-0014', outlookAddress: 'neuron-3-330@rooms.demo', sourceId: TERABEE_SOURCE },
  { roomId: 'neuron-3-333', building: 'neuron', floor: 3, name: 'Stiltekamer Faaborg', capacity: 4, deviceId: 'TB-PCL-0015', outlookAddress: 'neuron-3-333@rooms.demo', sourceId: TERABEE_SOURCE },
]

export const ORGANIZERS = [
  'Jörgen Månsson',
  'Anaïs Dubois',
  'Sanne de Vries',
  'Bram Willems',
  'Ingrid Sørensen',
  'Tomás Núñez',
  'Femke van den Berg',
  'Mikkel Østergaard',
]

export const SUBJECTS = [
  'Sprint review',
  'Kwartaalreview',
  '1:1',
  'Projectoverleg',
  'Design critique',
  'Budget alignment',
  'Stand-up (uitloop)',
  'Klantdemo',
  'Kennissessie',
  'Sollicitatiegesprek',
]

export function buildSources(nowIso: string): Source[] {
  return [
    { sourceId: TERABEE_SOURCE, displayName: 'Terabee People Counting (IoT Hub mock)', kind: 'sensor', status: 'active', lastSyncTs: nowIso },
    { sourceId: OUTLOOK_SOURCE, displayName: 'Outlook rooms & reservations (mock)', kind: 'calendar', status: 'active', lastSyncTs: nowIso },
  ]
}
