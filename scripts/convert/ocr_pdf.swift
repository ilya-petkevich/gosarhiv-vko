import Foundation
import PDFKit
import Vision
import AppKit

let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let doc = PDFDocument(url: url) else { print("no pdf"); exit(1) }
for i in 0..<doc.pageCount {
  guard let page = doc.page(at: i) else { continue }
  let b = page.bounds(for: .mediaBox)
  let scale: CGFloat = 3
  let img = NSImage(size: NSSize(width: b.width * scale, height: b.height * scale))
  img.lockFocus()
  NSColor.white.set(); NSRect(origin: .zero, size: img.size).fill()
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx)
  img.unlockFocus()
  var rect = NSRect(origin: .zero, size: img.size)
  guard let cg = img.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["ru-RU", "kk-KZ"]
  req.usesLanguageCorrection = true
  try? VNImageRequestHandler(cgImage: cg).perform([req])
  let obs = (req.results ?? []).sorted { a, b in
    let ya = a.boundingBox.midY, yb = b.boundingBox.midY
    if abs(ya - yb) > 0.006 { return ya > yb }
    return a.boundingBox.minX < b.boundingBox.minX
  }
  print("----- page \(i + 1)")
  var lastY: CGFloat = -1
  var line = ""
  for o in obs {
    let t = o.topCandidates(1).first?.string ?? ""
    if lastY >= 0 && abs(o.boundingBox.midY - lastY) > 0.006 { print(line); line = "" }
    line += (line.isEmpty ? "" : " | ") + t
    lastY = o.boundingBox.midY
  }
  print(line)
}
