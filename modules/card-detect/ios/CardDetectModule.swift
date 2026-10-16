import CoreImage
import ExpoModulesCore
import UIKit
import Vision

/// หาสี่เหลี่ยมสัดส่วนบัตร (85.6×54 มม.) ในรูป ด้วย Apple Vision
/// คืนกรอบแบบ normalized (0–1, จุดเริ่มมุมซ้ายบนของรูปที่หมุนถูกทิศแล้ว) + ความมั่นใจ
public class CardDetectModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CardDetect")

    AsyncFunction("detect") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
        promise.resolve(nil)
        return
      }
      // วาดใหม่ให้ทิศภาพถูกต้อง (ตัดปัญหา EXIF orientation)
      let fmt = UIGraphicsImageRendererFormat.default()
      fmt.scale = 1
      let upright = UIGraphicsImageRenderer(size: image.size, format: fmt).image { _ in image.draw(in: CGRect(origin: .zero, size: image.size)) }
      guard let cg = upright.cgImage else {
        promise.resolve(nil)
        return
      }
      let req = VNDetectRectanglesRequest { req, _ in
        guard let r = (req.results as? [VNRectangleObservation])?.first else {
          promise.resolve(nil)
          return
        }
        // Vision ใช้จุดกำเนิดมุมซ้ายล่าง → แปลงเป็นมุมซ้ายบน
        let b = r.boundingBox
        promise.resolve([
          "x": b.minX,
          "y": 1 - b.maxY,
          "width": b.width,
          "height": b.height,
          "confidence": r.confidence,
          "imageWidth": cg.width,
          "imageHeight": cg.height,
        ])
      }
      req.minimumAspectRatio = 0.5
      req.maximumAspectRatio = 0.75
      req.minimumSize = 0.3
      req.quadratureTolerance = 20
      req.minimumConfidence = 0.6
      req.maximumObservations = 1
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
        } catch {
          promise.resolve(nil)
        }
      }
    }

    /// หาบัตรในรูปเต็ม แล้วดัดมุมมองให้ตรง (perspective correction) ตัดพอดีขอบบัตร
    /// hint = กรอบบนจอ (normalized) ใช้เลือกสี่เหลี่ยมที่ใกล้กรอบที่สุด
    AsyncFunction("extract") { (uri: String, hint: [String: Double]?, promise: Promise) in
      guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
        promise.resolve(nil)
        return
      }
      let fmt = UIGraphicsImageRendererFormat.default()
      fmt.scale = 1
      let upright = UIGraphicsImageRenderer(size: image.size, format: fmt).image { _ in image.draw(in: CGRect(origin: .zero, size: image.size)) }
      guard let cg = upright.cgImage else {
        promise.resolve(nil)
        return
      }
      let W = CGFloat(cg.width), H = CGFloat(cg.height)
      let req = VNDetectRectanglesRequest { req, _ in
        let all = (req.results as? [VNRectangleObservation]) ?? []
        // เลือกสี่เหลี่ยมที่จุดกลางใกล้กรอบที่สุด
        var best = all.first
        if let h = hint, let hx = h["x"], let hy = h["y"], let hw = h["width"], let hh = h["height"] {
          let cx = hx + hw / 2, cy = 1 - (hy + hh / 2)
          best = all.min(by: { a, b in
            hypot(a.boundingBox.midX - cx, a.boundingBox.midY - cy) < hypot(b.boundingBox.midX - cx, b.boundingBox.midY - cy)
          })
        }
        guard let r = best else {
          promise.resolve(nil)
          return
        }
        let pt = { (p: CGPoint) in CIVector(x: p.x * W, y: p.y * H) }
        let ci = CIImage(cgImage: cg)
        guard let f = CIFilter(name: "CIPerspectiveCorrection") else {
          promise.resolve(nil)
          return
        }
        f.setValue(ci, forKey: kCIInputImageKey)
        f.setValue(pt(r.topLeft), forKey: "inputTopLeft")
        f.setValue(pt(r.topRight), forKey: "inputTopRight")
        f.setValue(pt(r.bottomLeft), forKey: "inputBottomLeft")
        f.setValue(pt(r.bottomRight), forKey: "inputBottomRight")
        guard var out = f.outputImage else {
          promise.resolve(nil)
          return
        }
        // บัตรต้องเป็นแนวนอน — ถ้าได้แนวตั้งให้หมุน 90°
        if out.extent.height > out.extent.width {
          out = out.oriented(.right)
        }
        let ctx = CIContext()
        guard let outCG = ctx.createCGImage(out, from: out.extent),
              let jpg = UIImage(cgImage: outCG).jpegData(compressionQuality: 0.92) else {
          promise.resolve(nil)
          return
        }
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("idcard-\(UUID().uuidString).jpg")
        do {
          try jpg.write(to: file)
          promise.resolve([
            "uri": file.absoluteString,
            "width": outCG.width,
            "height": outCG.height,
            // ตำแหน่งบัตรในรูปเต็ม (normalized, มุมซ้ายบน) ใช้เริ่มแอนิเมชัน
            "x": r.boundingBox.minX,
            "y": 1 - r.boundingBox.maxY,
            "boxWidth": r.boundingBox.width,
            "boxHeight": r.boundingBox.height,
          ])
        } catch {
          promise.resolve(nil)
        }
      }
      req.minimumAspectRatio = 0.5
      req.maximumAspectRatio = 0.75
      req.minimumSize = 0.25
      req.quadratureTolerance = 25
      req.minimumConfidence = 0.5
      req.maximumObservations = 4
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
        } catch {
          promise.resolve(nil)
        }
      }
    }
      /// ตำรา/สมุดข่อย/ใบลาน: หาขอบเอกสารด้วย Document Segmentation แล้วดัดให้ตรง (ไม่จำกัดสัดส่วน ไม่หมุน)
    AsyncFunction("extractDoc") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
        promise.resolve(nil)
        return
      }
      let fmt = UIGraphicsImageRendererFormat.default()
      fmt.scale = 1
      let upright = UIGraphicsImageRenderer(size: image.size, format: fmt).image { _ in image.draw(in: CGRect(origin: .zero, size: image.size)) }
      guard let cg = upright.cgImage else {
        promise.resolve(nil)
        return
      }
      let W = CGFloat(cg.width), H = CGFloat(cg.height)
      let req = VNDetectDocumentSegmentationRequest { req, _ in
        guard let r = (req.results as? [VNRectangleObservation])?.first, r.boundingBox.width * r.boundingBox.height > 0.12 else {
          promise.resolve(nil)
          return
        }
        let pt = { (p: CGPoint) in CIVector(x: p.x * W, y: p.y * H) }
        guard let f = CIFilter(name: "CIPerspectiveCorrection") else {
          promise.resolve(nil)
          return
        }
        f.setValue(CIImage(cgImage: cg), forKey: kCIInputImageKey)
        f.setValue(pt(r.topLeft), forKey: "inputTopLeft")
        f.setValue(pt(r.topRight), forKey: "inputTopRight")
        f.setValue(pt(r.bottomLeft), forKey: "inputBottomLeft")
        f.setValue(pt(r.bottomRight), forKey: "inputBottomRight")
        guard let out = f.outputImage, let outCG = CIContext().createCGImage(out, from: out.extent),
              let jpg = UIImage(cgImage: outCG).jpegData(compressionQuality: 0.92) else {
          promise.resolve(nil)
          return
        }
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("doc-\(UUID().uuidString).jpg")
        do {
          try jpg.write(to: file)
          promise.resolve([
            "uri": file.absoluteString,
            "width": outCG.width,
            "height": outCG.height,
            "x": r.boundingBox.minX,
            "y": 1 - r.boundingBox.maxY,
            "boxWidth": r.boundingBox.width,
            "boxHeight": r.boundingBox.height,
          ])
        } catch {
          promise.resolve(nil)
        }
      }
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
        } catch {
          promise.resolve(nil)
        }
      }
    }
  }
}
