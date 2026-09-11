export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

export async function POST(req: NextRequest) {
  const { content, filename } = await req.json()

  const chunks: Buffer[] = []
  const doc = new PDFDocument({ margin: 55, size: 'LETTER' })
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)

    const pageWidth = 612 - 110 // letter width minus margins

    // Check for new structured format
    if (content.includes('[HEADER]')) {
      const lines = content.split('\n')
      let i = 0

      while (i < lines.length) {
        const line = lines[i].trim()

        if (line === '[HEADER]') {
          // Centered name + contact block
          i++
          const name = lines[i]?.trim() ?? ''
          i++
          const contact = lines[i]?.trim() ?? ''
          i++ // skip [/HEADER]
          i++

          doc.font('Helvetica-Bold').fontSize(16)
            .text(name, 55, doc.y, { width: pageWidth, align: 'center' })
          doc.font('Helvetica').fontSize(10)
            .text(contact, 55, doc.y + 2, { width: pageWidth, align: 'center' })
          doc.moveDown(0.8)

          // Divider line
          const y = doc.y
          doc.moveTo(55, y).lineTo(557, y).lineWidth(0.75).stroke()
          doc.moveDown(0.6)

        } else if (line.startsWith('[SECTION]')) {
          const title = line.replace('[SECTION]', '').replace('[/SECTION]', '')
          doc.moveDown(0.4)
          doc.font('Helvetica-Bold').fontSize(11)
            .text(title.toUpperCase(), 55, doc.y, { width: pageWidth })
          // Underline
          const y = doc.y
          doc.moveTo(55, y).lineTo(557, y).lineWidth(0.5).stroke()
          doc.moveDown(0.3)
          i++

        } else if (line.startsWith('[JOB]')) {
          const jobLine = line.replace('[JOB]', '').replace('[/JOB]', '')
          // Split "Company - Title | Dates"
          const parts = jobLine.split('|')
          const titlePart = parts[0]?.trim() ?? jobLine
          const datePart = parts[1]?.trim() ?? ''

          doc.font('Helvetica-Bold').fontSize(10.5)
          if (datePart) {
            // Company/title left, dates right
            const dateWidth = doc.widthOfString(datePart) + 5
            doc.text(titlePart, 55, doc.y, { width: pageWidth - dateWidth, continued: true })
            doc.font('Helvetica').text(datePart, { align: 'right' })
          } else {
            doc.text(titlePart, 55, doc.y, { width: pageWidth })
          }
          doc.moveDown(0.15)
          i++

        } else if (line.startsWith('- ') || line.startsWith('• ')) {
          doc.font('Helvetica').fontSize(10)
            .text(line, 55, doc.y, { width: pageWidth, indent: 12, lineGap: 1.5 })
          i++

        } else if (line === '' || line === '[/HEADER]') {
          if (line === '') doc.moveDown(0.3)
          i++

        } else {
          doc.font('Helvetica').fontSize(10)
            .text(line, 55, doc.y, { width: pageWidth, lineGap: 1.5 })
          i++
        }
      }

    } else {
      // Legacy plain text fallback
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed === '') {
          doc.moveDown(0.4)
        } else if (trimmed.match(/^[A-Z][A-Z\s&|\/\-]{4,}$/) && trimmed.length < 60) {
          doc.moveDown(0.3).font('Helvetica-Bold').fontSize(11).text(trimmed).font('Helvetica').fontSize(11)
        } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          doc.text(trimmed, { indent: 16, lineGap: 2 })
        } else {
          doc.font('Helvetica').fontSize(11).text(trimmed, { lineGap: 2 })
        }
      }
    }

    doc.end()
  })

  const pdf = Buffer.concat(chunks)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
