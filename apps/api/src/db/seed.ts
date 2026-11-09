import { db } from './client.js'
import { scheduleBlocks, tracks, units } from './schema.js'

// Designing Data-Intensive Applications, first edition.
const ddiaChapters = [
  'Reliable, Scalable, and Maintainable Applications',
  'Data Models and Query Languages',
  'Storage and Retrieval',
  'Encoding and Evolution',
  'Replication',
  'Partitioning',
  'Transactions',
  'The Trouble with Distributed Systems',
  'Consistency and Consensus',
  'Batch Processing',
  'Stream Processing',
  'The Future of Data Systems',
]

const trackRows = [
  { slug: 'ddia', name: 'DDIA book', color: '#4338CA', unitLabel: 'chapter', totalUnits: 12 },
  { slug: 'devops', name: 'DevOps course', color: '#0F766E', unitLabel: 'section', totalUnits: 32 },
  // 25 fundamentals lessons plus 13 design questions.
  { slug: 'systems', name: 'SystemsExpert', color: '#C2410C', unitLabel: 'lesson', totalUnits: 38 },
  { slug: 'dsa', name: 'AlgoExpert DSA', color: '#BE185D', unitLabel: 'problem', totalUnits: null },
  { slug: 'react', name: 'React interview', color: '#6D28D9', unitLabel: 'question', totalUnits: null },
]

// Mornings: DDIA then the DevOps course. Evenings: SystemsExpert, then React (Mon/Wed/Fri) or DSA (Tue/Thu).
function routine(ids: Record<string, number>) {
  return [1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startTime: '06:30', minutes: 60, trackId: ids.ddia! },
    { weekday, startTime: '07:30', minutes: 60, trackId: ids.devops! },
    { weekday, startTime: '18:30', minutes: 25, trackId: ids.systems! },
    { weekday, startTime: '19:00', minutes: 30, trackId: weekday % 2 === 1 ? ids.react! : ids.dsa! },
  ])
}

// Fills an empty database with the tracks, DDIA's chapters and the weekly routine. Safe to run on every start.
export async function seed() {
  const existing = await db.select({ id: tracks.id }).from(tracks).limit(1)
  if (existing.length > 0) return false

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(tracks)
      .values(trackRows.map((row, position) => ({ ...row, position })))
      .returning({ id: tracks.id, slug: tracks.slug })
    const ids = Object.fromEntries(inserted.map((t) => [t.slug, t.id]))

    await tx.insert(units).values(ddiaChapters.map((title, i) => ({ trackId: ids.ddia!, title, position: i + 1 })))
    await tx.insert(scheduleBlocks).values(routine(ids))
  })
  return true
}
