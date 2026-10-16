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
  }
}
