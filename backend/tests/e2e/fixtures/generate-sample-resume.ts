/**
 * Regenerates sample-resume.docx, the e2e fixture used by golden-path.spec.ts.
 * Run with: npx ts-node tests/e2e/fixtures/generate-sample-resume.ts
 *
 * .docx rather than .pdf: three independent PDF generators (reportlab,
 * pdfkit, fpdf2) all produced files that pdf-parse@1.1.4 (the library
 * resumeParser.ts actually uses) rejected with "bad XRef entry", while it
 * reads complex real-world PDFs (e.g. an Office/Docs export) fine — a real
 * pdf-parse limitation with minimal/simple PDFs, not a bug in this app.
 * mammoth (the app's .docx parser) round-trips a freshly generated .docx
 * cleanly, so that's the fixture format here.
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import fs from 'fs'
import path from 'path'

const heading = (text: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true })] })
const body = (text: string) => new Paragraph({ children: [new TextRun(text)] })

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({ children: [new TextRun({ text: 'Jordan Rivera', bold: true, size: 32 })] }),
        body('Senior Backend Engineer'),
        body('Springfield, USA | jordan.rivera@example.com | 555-0100 | linkedin.com/in/jordanrivera'),

        heading('PROFESSIONAL SUMMARY'),
        body(
          'Backend engineer with 8+ years building distributed systems in Python, Go, and Node.js on AWS. ' +
            'Experienced leading small teams and owning services end to end in production.'
        ),

        heading('CORE SKILLS'),
        body('Python, Go, Node.js, PostgreSQL, Redis, AWS, Docker, Kubernetes, REST APIs, microservices'),

        heading('PROFESSIONAL EXPERIENCE'),
        new Paragraph({ children: [new TextRun({ text: 'Senior Backend Engineer - Example Corp, Remote', bold: true })] }),
        body('Jan 2021 - Present'),
        body('- Designed and operated microservices handling 5M+ daily requests on AWS.'),
        body('- Led migration of a monolithic billing service to Go-based microservices.'),
        body('- Mentored two junior engineers and ran the on-call rotation.'),

        new Paragraph({ children: [new TextRun({ text: 'Backend Engineer - Sample Inc, Remote', bold: true })] }),
        body('Jun 2017 - Dec 2020'),
        body('- Built REST APIs in Python/Django for a B2B SaaS platform.'),
        body('- Implemented CI/CD pipelines with Docker and GitHub Actions.'),

        heading('EDUCATION'),
        body('B.S. Computer Science - State University, 2013 - 2017'),
      ],
    },
  ],
})

const outPath = path.join(__dirname, 'sample-resume.docx')
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf)
  // eslint-disable-next-line no-console
  console.log('wrote', outPath)
})
