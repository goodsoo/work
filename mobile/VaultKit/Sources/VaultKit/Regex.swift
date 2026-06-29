import Foundation

// NSRegularExpression 얇은 래퍼 — TS 의 `str.match(re)` / `str.replace(re, fn)` 를
// 최대한 그대로 옮기기 위한 헬퍼. ICU 정규식은 `\p{L}`/`\p{N}` 유니코드 속성과
// non-capturing group, lookahead 를 모두 지원하므로 데스크탑 패턴을 문자 그대로 쓴다.

struct RE {
    let regex: NSRegularExpression

    init(_ pattern: String, _ options: NSRegularExpression.Options = []) {
        // 패턴은 전부 컴파일 타임 상수라 강제 unwrap 이 안전.
        regex = try! NSRegularExpression(pattern: pattern, options: options)
    }

    /// 첫 매치의 캡처 그룹들. group[0] = 전체 매치, group[1..] = 캡처.
    /// 매치 없으면 nil. 매치된 그룹이 비어있으면(optional group) 해당 원소 nil.
    func firstMatch(_ s: String) -> Match? {
        let ns = s as NSString
        guard let m = regex.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else {
            return nil
        }
        return Match(result: m, source: ns)
    }

    func matches(_ s: String) -> Bool {
        let ns = s as NSString
        return regex.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) != nil
    }

    /// 전역 치환 + 콜백 (TS 의 `replace(re_g, (whole, g1) => ...)` 대응).
    /// 콜백은 (전체매치, 캡처1) 를 받아 대체 문자열을 반환.
    func replaceAll(_ s: String, _ transform: (_ whole: String, _ group1: String?) -> String) -> String {
        let ns = s as NSString
        let all = regex.matches(in: s, range: NSRange(location: 0, length: ns.length))
        guard !all.isEmpty else { return s }
        var result = ""
        var last = 0
        for m in all {
            let r = m.range
            result += ns.substring(with: NSRange(location: last, length: r.location - last))
            let whole = ns.substring(with: r)
            var g1: String? = nil
            if m.numberOfRanges > 1 {
                let gr = m.range(at: 1)
                if gr.location != NSNotFound {
                    g1 = ns.substring(with: gr)
                }
            }
            result += transform(whole, g1)
            last = r.location + r.length
        }
        result += ns.substring(with: NSRange(location: last, length: ns.length - last))
        return result
    }
}

struct Match {
    let result: NSTextCheckingResult
    let source: NSString

    /// 캡처 그룹 문자열. 인덱스 0 = 전체 매치. 매치 안 된 optional group 은 nil.
    func group(_ i: Int) -> String? {
        guard i < result.numberOfRanges else { return nil }
        let r = result.range(at: i)
        if r.location == NSNotFound { return nil }
        return source.substring(with: r)
    }

    /// 전체 매치의 시작 위치 (UTF-16 offset). TS 의 `match.index` 대응.
    var index: Int { result.range.location }

    /// 전체 매치 길이.
    var length: Int { result.range.length }
}

extension String {
    /// 0 채움 좌측 패딩 (TS `String.padStart`). 숫자 토큰 정규화용.
    func padLeft(_ width: Int, _ pad: Character = "0") -> String {
        if count >= width { return self }
        return String(repeating: pad, count: width - count) + self
    }

    /// UTF-16 offset 기준 prefix (NSString range 와 정합). TS 의 `slice(0, idx)`.
    func utf16Prefix(_ end: Int) -> String {
        (self as NSString).substring(to: end)
    }

    /// UTF-16 offset 기준 suffix (NSString range 와 정합). TS 의 `slice(start)`.
    func utf16Suffix(_ start: Int) -> String {
        let ns = self as NSString
        if start >= ns.length { return "" }
        return ns.substring(from: start)
    }
}
