import AppKit
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Bitmap {
    let width: Int
    let height: Int
    var pixels: [UInt8]
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("assets/illustrations/icons")

func load(_ name: String) -> Bitmap {
    let url = root.appendingPathComponent(name)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fatalError("Cannot load \(url.path)")
    }
    let width = image.width, height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let space = CGColorSpaceCreateDeviceRGB()
    let info = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
    pixels.withUnsafeMutableBytes { bytes in
        let context = CGContext(data: bytes.baseAddress, width: width, height: height,
                                bitsPerComponent: 8, bytesPerRow: width * 4,
                                space: space, bitmapInfo: info)!
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    return Bitmap(width: width, height: height, pixels: pixels)
}

func cgImage(_ bitmap: Bitmap) -> CGImage {
    let data = Data(bitmap.pixels) as CFData
    let provider = CGDataProvider(data: data)!
    let space = CGColorSpaceCreateDeviceRGB()
    let info = CGBitmapInfo.byteOrder32Big.union(
        CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue))
    return CGImage(width: bitmap.width, height: bitmap.height,
                   bitsPerComponent: 8, bitsPerPixel: 32,
                   bytesPerRow: bitmap.width * 4, space: space,
                   bitmapInfo: info, provider: provider,
                   decode: nil, shouldInterpolate: true, intent: .defaultIntent)!
}

func save(_ bitmap: Bitmap, _ name: String) {
    let url = root.appendingPathComponent(name)
    guard let destination = CGImageDestinationCreateWithURL(
        url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        fatalError("Cannot create \(url.path)")
    }
    CGImageDestinationAddImage(destination, cgImage(bitmap), nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot save \(url.path)") }
}

func unpremultiplied(_ bitmap: Bitmap, _ offset: Int) -> (Double, Double, Double, Double) {
    let a = Double(bitmap.pixels[offset + 3])
    guard a > 0 else { return (0, 0, 0, 0) }
    let factor = 255.0 / a
    return (Double(bitmap.pixels[offset]) * factor,
            Double(bitmap.pixels[offset + 1]) * factor,
            Double(bitmap.pixels[offset + 2]) * factor, a)
}

func setPixel(_ bitmap: inout Bitmap, _ offset: Int, r: Double, g: Double, b: Double, a: Double) {
    let alpha = max(0, min(255, a))
    let factor = alpha / 255.0
    bitmap.pixels[offset] = UInt8(max(0, min(255, r * factor)).rounded())
    bitmap.pixels[offset + 1] = UInt8(max(0, min(255, g * factor)).rounded())
    bitmap.pixels[offset + 2] = UInt8(max(0, min(255, b * factor)).rounded())
    bitmap.pixels[offset + 3] = UInt8(alpha.rounded())
}

func recolorRegion(_ name: String, region: CGRect,
                   predicate: (Double, Double, Double) -> Bool,
                   target: (Double, Double, Double), referenceLuma: Double) {
    var bitmap = load(name)
    for y in 0..<bitmap.height where region.contains(CGPoint(x: 0, y: y)) ||
        (CGFloat(y) >= region.minY && CGFloat(y) <= region.maxY) {
        for x in 0..<bitmap.width {
            guard region.contains(CGPoint(x: x, y: y)) else { continue }
            let offset = (y * bitmap.width + x) * 4
            let (r, g, b, a) = unpremultiplied(bitmap, offset)
            guard a > 0, predicate(r, g, b) else { continue }
            let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            let ratio = max(0.68, min(1.32, luma / referenceLuma))
            setPixel(&bitmap, offset, r: target.0 * ratio,
                     g: target.1 * ratio, b: target.2 * ratio, a: a)
        }
    }
    save(bitmap, name)
}

func alphaBounds(_ bitmap: Bitmap, threshold: UInt8 = 12) -> CGRect {
    var minX = bitmap.width, minY = bitmap.height, maxX = -1, maxY = -1
    for y in 0..<bitmap.height {
        for x in 0..<bitmap.width where bitmap.pixels[(y * bitmap.width + x) * 4 + 3] > threshold {
            minX = min(minX, x); minY = min(minY, y)
            maxX = max(maxX, x); maxY = max(maxY, y)
        }
    }
    return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
}

func sampleBilinear(_ bitmap: Bitmap, x: Double, y: Double) -> (Double, Double, Double, Double) {
    guard x >= 0, y >= 0, x < Double(bitmap.width - 1), y < Double(bitmap.height - 1) else {
        return (0, 0, 0, 0)
    }
    let x0 = Int(floor(x)), y0 = Int(floor(y)), x1 = x0 + 1, y1 = y0 + 1
    let fx = x - Double(x0), fy = y - Double(y0)
    func channel(_ c: Int) -> Double {
        let p00 = Double(bitmap.pixels[(y0 * bitmap.width + x0) * 4 + c])
        let p10 = Double(bitmap.pixels[(y0 * bitmap.width + x1) * 4 + c])
        let p01 = Double(bitmap.pixels[(y1 * bitmap.width + x0) * 4 + c])
        let p11 = Double(bitmap.pixels[(y1 * bitmap.width + x1) * 4 + c])
        return (p00 * (1 - fx) + p10 * fx) * (1 - fy) +
               (p01 * (1 - fx) + p11 * fx) * fy
    }
    return (channel(0), channel(1), channel(2), channel(3))
}

func transform(_ name: String, scaleToMaxFraction target: Double, rotationDegrees: Double = 0,
               yOpticalOffset: Double = 0) {
    let source = load(name)
    let bounds = alphaBounds(source)
    let sourceCenter = CGPoint(x: bounds.midX, y: bounds.midY)
    let angle = rotationDegrees * .pi / 180
    let c = cos(angle), s = sin(angle)

    var minTX = Double.greatestFiniteMagnitude, minTY = Double.greatestFiniteMagnitude
    var maxTX = -Double.greatestFiniteMagnitude, maxTY = -Double.greatestFiniteMagnitude
    for y in Int(bounds.minY)...Int(bounds.maxY) {
        for x in Int(bounds.minX)...Int(bounds.maxX) {
            guard source.pixels[(y * source.width + x) * 4 + 3] > 12 else { continue }
            let dx = Double(x) - sourceCenter.x, dy = Double(y) - sourceCenter.y
            let tx = c * dx - s * dy, ty = s * dx + c * dy
            minTX = min(minTX, tx); maxTX = max(maxTX, tx)
            minTY = min(minTY, ty); maxTY = max(maxTY, ty)
        }
    }
    let transformedWidth = maxTX - minTX + 1
    let transformedHeight = maxTY - minTY + 1
    let desired = target * Double(min(source.width, source.height))
    let scale = desired / max(transformedWidth, transformedHeight)
    let destinationCenter = CGPoint(x: Double(source.width) / 2,
                                    y: Double(source.height) / 2 + yOpticalOffset)
    var output = Bitmap(width: source.width, height: source.height,
                        pixels: [UInt8](repeating: 0, count: source.width * source.height * 4))
    for y in 0..<output.height {
        for x in 0..<output.width {
            let dx = (Double(x) - destinationCenter.x) / scale
            let dy = (Double(y) - destinationCenter.y) / scale
            let sx = c * dx + s * dy + sourceCenter.x
            let sy = -s * dx + c * dy + sourceCenter.y
            let (r, g, b, a) = sampleBilinear(source, x: sx, y: sy)
            let offset = (y * output.width + x) * 4
            output.pixels[offset] = UInt8(max(0, min(255, r)).rounded())
            output.pixels[offset + 1] = UInt8(max(0, min(255, g)).rounded())
            output.pixels[offset + 2] = UInt8(max(0, min(255, b)).rounded())
            output.pixels[offset + 3] = UInt8(max(0, min(255, a)).rounded())
        }
    }
    save(output, name)
}

func make48(_ name: String) {
    let source = load(name)
    let image = cgImage(source)
    let width = 48, height = 48
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let space = CGColorSpaceCreateDeviceRGB()
    let info = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
    pixels.withUnsafeMutableBytes { bytes in
        let context = CGContext(data: bytes.baseAddress, width: width, height: height,
                                bitsPerComponent: 8, bytesPerRow: width * 4,
                                space: space, bitmapInfo: info)!
        context.interpolationQuality = .high
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    save(Bitmap(width: width, height: height, pixels: pixels),
         name.replacingOccurrences(of: ".png", with: "-48.png"))
}

func removeChroma(_ sourceName: String, outputName: String) {
    let source = load(sourceName)
    let border = [
        (0, 0), (source.width - 1, 0),
        (0, source.height - 1), (source.width - 1, source.height - 1)
    ]
    let samples = border.map { point -> (Double, Double, Double) in
        let offset = (point.1 * source.width + point.0) * 4
        return (Double(source.pixels[offset]), Double(source.pixels[offset + 1]),
                Double(source.pixels[offset + 2]))
    }
    let key = (samples.map(\.0).reduce(0, +) / Double(samples.count),
               samples.map(\.1).reduce(0, +) / Double(samples.count),
               samples.map(\.2).reduce(0, +) / Double(samples.count))
    var output = source
    for y in 0..<source.height {
        for x in 0..<source.width {
            let offset = (y * source.width + x) * 4
            let r = Double(source.pixels[offset]), g = Double(source.pixels[offset + 1])
            let b = Double(source.pixels[offset + 2])
            let distance = max(abs(r - key.0), abs(g - key.1), abs(b - key.2))
            let t = max(0, min(1, (distance - 24) / (92 - 24)))
            let alpha = t * t * (3 - 2 * t)
            guard alpha > 0.002 else {
                output.pixels[offset] = 0; output.pixels[offset + 1] = 0
                output.pixels[offset + 2] = 0; output.pixels[offset + 3] = 0
                continue
            }
            let rr = (r - (1 - alpha) * key.0) / alpha
            let gg = (g - (1 - alpha) * key.1) / alpha
            let bb = (b - (1 - alpha) * key.2) / alpha
            setPixel(&output, offset, r: rr, g: gg, b: bb, a: 255 * alpha)
        }
    }
    save(output, outputName)
}

func reframe(_ name: String, canvas: Int = 1254, scaleToMaxFraction target: Double,
             yOpticalOffset: Double = 0) {
    let source = load(name)
    let bounds = alphaBounds(source)
    let scale = target * Double(canvas) / max(Double(bounds.width), Double(bounds.height))
    let sourceCenter = CGPoint(x: bounds.midX, y: bounds.midY)
    let destinationCenter = CGPoint(x: Double(canvas) / 2,
                                    y: Double(canvas) / 2 + yOpticalOffset)
    var output = Bitmap(width: canvas, height: canvas,
                        pixels: [UInt8](repeating: 0, count: canvas * canvas * 4))
    for y in 0..<canvas {
        for x in 0..<canvas {
            let sx = (Double(x) - destinationCenter.x) / scale + sourceCenter.x
            let sy = (Double(y) - destinationCenter.y) / scale + sourceCenter.y
            let (r, g, b, a) = sampleBilinear(source, x: sx, y: sy)
            let offset = (y * canvas + x) * 4
            output.pixels[offset] = UInt8(max(0, min(255, r)).rounded())
            output.pixels[offset + 1] = UInt8(max(0, min(255, g)).rounded())
            output.pixels[offset + 2] = UInt8(max(0, min(255, b)).rounded())
            output.pixels[offset + 3] = UInt8(max(0, min(255, a)).rounded())
        }
    }
    save(output, name)
}

// Scorecard #3: change only the teal underside shadow to palette deep navy.
recolorRegion("02-street-fashion.png", region: CGRect(x: 0, y: 570, width: 500, height: 410),
              predicate: { r, g, b in g > r * 1.08 && g > b * 1.08 },
              target: (25, 57, 78), referenceLuma: 112)

// Scorecard #8 and #15: deliberately increase optical presence further.
transform("24-random-kindness.png", scaleToMaxFraction: 0.99, yOpticalOffset: 5)
transform("10-farmers-market.png", scaleToMaxFraction: 0.985, yOpticalOffset: 6)

// Scorecard #18: recolor the approved dark door to project marigold.
recolorRegion("23-group-stoop.png", region: CGRect(x: 360, y: 50, width: 500, height: 670),
              predicate: { r, g, b in r < 70 && g < 70 && b < 70 },
              target: (246, 185, 0), referenceLuma: 37)

// Scorecard #17: use the regenerated, wider and more horizontal chroma source.
removeChroma("sources/18-street-mural-chroma.png", outputName: "18-street-mural.png")
reframe("18-street-mural.png", scaleToMaxFraction: 0.92, yOpticalOffset: 0)

for name in ["02-street-fashion.png", "24-random-kindness.png", "10-farmers-market.png",
             "23-group-stoop.png", "18-street-mural.png"] {
    make48(name)
    let bitmap = load(name)
    let b = alphaBounds(bitmap)
    print("\(name): \(Int(b.width))x\(Int(b.height)) at (\(Int(b.minX)),\(Int(b.minY)))")
}
