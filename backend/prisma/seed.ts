import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding CrowdStudio database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create Demo Producer & Community Members
  const demoProducer = await prisma.user.upsert({
    where: { username: "demo_producer" },
    update: {},
    create: {
      email: "demo@crowdstudio.ai",
      username: "demo_producer",
      passwordHash,
      displayName: "Demo Producer 🎵",
      bio: "Crafting synthwave rhythms and cybernetic beats in CrowdStudio.",
    },
  });

  const synthMaster = await prisma.user.upsert({
    where: { username: "synth_master" },
    update: {},
    create: {
      email: "master@crowdstudio.ai",
      username: "synth_master",
      passwordHash,
      displayName: "Synth Master ✨",
      bio: "Analog synthesizers, modular patches, and deep ambient soundscapes.",
    },
  });

  const lofiChill = await prisma.user.upsert({
    where: { username: "lofi_beats" },
    update: {},
    create: {
      email: "lofi@crowdstudio.ai",
      username: "lofi_beats",
      passwordHash,
      displayName: "Lo-Fi Beats ☕",
      bio: "Chill chords, vinyl warmth, and rainy day coffee sessions.",
    },
  });

  console.log("✅ Created demo users");

  // 2. Create Sample Tracks (both live Jams and Spotify songs)
  const track1 = await prisma.track.upsert({
    where: { id: "seed-track-1" },
    update: {},
    create: {
      id: "seed-track-1",
      title: "Neon Cyberpunk Sunset",
      description: "Driving minor synthwave jam rendered in CrowdStudio with heavy arpeggio and saturated low-pass filter.",
      kind: "jam",
      durationSec: 120,
      playCount: 142,
      jamConfig: {
        tempo: 118,
        rootNote: "A",
        scale: "minor",
        filterCutoff: 3800,
        reverbWet: 0.4,
        energy: 0.85,
      },
      authorId: demoProducer.id,
    },
  });

  const track2 = await prisma.track.upsert({
    where: { id: "seed-track-2" },
    update: {},
    create: {
      id: "seed-track-2",
      title: "Midnight Rain & Tape Echo",
      description: "Slow-tempo lofi groove with soft diatonic chords and warm tape-saturated delay.",
      kind: "jam",
      durationSec: 90,
      playCount: 88,
      jamConfig: {
        tempo: 82,
        rootNote: "D",
        scale: "minor",
        filterCutoff: 1400,
        reverbWet: 0.55,
        energy: 0.5,
      },
      authorId: lofiChill.id,
    },
  });

  const track3 = await prisma.track.upsert({
    where: { id: "seed-track-3" },
    update: {},
    create: {
      id: "seed-track-3",
      title: "Celestial Drift",
      description: "Ethereal pentatonic ambient excursion with maximum reverb space.",
      kind: "jam",
      durationSec: 180,
      playCount: 65,
      jamConfig: {
        tempo: 75,
        rootNote: "C",
        scale: "pentatonic",
        filterCutoff: 900,
        reverbWet: 0.7,
        energy: 0.35,
      },
      authorId: synthMaster.id,
    },
  });

  const track4 = await prisma.track.upsert({
    where: { id: "seed-track-4" },
    update: {},
    create: {
      id: "seed-track-4",
      title: "Blinding Lights",
      description: "Synthwave pop masterpiece by The Weeknd curated from Spotify.",
      kind: "spotify",
      spotifyTrackId: "0VjIjW4GlUZAMYd2vXMi3b",
      spotifyArtist: "The Weeknd",
      spotifyUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
      durationSec: 200,
      playCount: 310,
      authorId: demoProducer.id,
    },
  });

  const track5 = await prisma.track.upsert({
    where: { id: "seed-track-5" },
    update: {},
    create: {
      id: "seed-track-5",
      title: "Midnight City",
      description: "Iconic electronic indie classic by M83 from Spotify.",
      kind: "spotify",
      spotifyTrackId: "6GyFP1nfCDB8Jyik5z8FuW",
      spotifyArtist: "M83",
      spotifyUrl: "https://open.spotify.com/track/6GyFP1nfCDB8Jyik5z8FuW",
      durationSec: 243,
      playCount: 195,
      authorId: synthMaster.id,
    },
  });

  console.log("✅ Created sample tracks");

  // 3. Create Sample Likes
  const sampleLikes = [
    { userId: demoProducer.id, trackId: track2.id },
    { userId: synthMaster.id, trackId: track1.id },
    { userId: lofiChill.id, trackId: track1.id },
    { userId: lofiChill.id, trackId: track4.id },
    { userId: demoProducer.id, trackId: track5.id },
  ];

  for (const like of sampleLikes) {
    await prisma.like.upsert({
      where: { userId_trackId: { userId: like.userId, trackId: like.trackId } },
      update: {},
      create: like,
    }).catch(() => {});
  }

  // 4. Create Sample Comments
  await prisma.comment.createMany({
    data: [
      {
        body: "The bassline progression in bar 4 is immaculate! 🔥",
        userId: synthMaster.id,
        trackId: track1.id,
      },
      {
        body: "Perfect study background music. Love the cutoff automation!",
        userId: demoProducer.id,
        trackId: track2.id,
      },
      {
        body: "All-time favorite synthwave track. Excited to see real Spotify embedding here!",
        userId: lofiChill.id,
        trackId: track4.id,
      },
    ],
    skipDuplicates: true,
  }).catch(() => {});

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
