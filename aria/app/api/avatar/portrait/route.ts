import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  // TMMT root is one level up from aria/
  const portraitPath = join(process.cwd(), '..', '.aixmos', 'face', 'active_portrait.jpg')
  try {
    const img = readFileSync(portraitPath)
    return new NextResponse(img, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
