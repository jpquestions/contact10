import Foundation

enum ApiError: Error {
  case network
  case rejected(String)
}

struct AddPointsResult: Decodable {
  var lifetimePoints: Int
  var gamePoints: Int?
}

/// Talks to Firebase directly so a widget tap works without opening the app.
enum Api {
  /// Exchanges the stored refresh token for a short lived ID token, cached
  /// until shortly before it expires.
  static func idToken(_ state: SharedState) async throws -> String {
    let defaults = Store.defaults
    if let token = defaults?.string(forKey: "idToken"),
       let expiry = defaults?.double(forKey: "idTokenExpiry"),
       expiry > Date().timeIntervalSince1970 + 60 {
      return token
    }
    var request = URLRequest(url: URL(string: "https://securetoken.googleapis.com/v1/token?key=\(state.apiKey)")!)
    request.httpMethod = "POST"
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    let token = state.refreshToken.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? state.refreshToken
    request.httpBody = "grant_type=refresh_token&refresh_token=\(token)".data(using: .utf8)

    let (data, response) = try await send(request)
    guard (response as? HTTPURLResponse)?.statusCode == 200,
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let idToken = json["id_token"] as? String else {
      throw ApiError.rejected("Open Contact 10 to sign in again.")
    }
    let lifetime = Double(json["expires_in"] as? String ?? "3600") ?? 3600
    defaults?.set(idToken, forKey: "idToken")
    defaults?.set(Date().timeIntervalSince1970 + lifetime, forKey: "idTokenExpiry")
    return idToken
  }

  static func addPoints(_ state: SharedState, _ entry: PendingEntry) async throws -> AddPointsResult {
    let token = try await idToken(state)
    var request = URLRequest(url: URL(string: "\(state.functionsBase)/addPoints")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    var payload: [String: Any] = ["entryId": entry.entryId, "amount": entry.amount, "source": "widget"]
    payload["gameId"] = entry.gameId ?? NSNull()
    request.httpBody = try JSONSerialization.data(withJSONObject: ["data": payload])

    let (data, _) = try await send(request)
    struct Envelope: Decodable {
      struct Failure: Decodable { var message: String }
      var result: AddPointsResult?
      var error: Failure?
    }
    let envelope = try JSONDecoder().decode(Envelope.self, from: data)
    if let result = envelope.result { return result }
    throw ApiError.rejected(envelope.error?.message ?? "Could not add points.")
  }

  private static func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
    var request = request
    request.timeoutInterval = 15
    do {
      return try await URLSession.shared.data(for: request)
    } catch {
      throw ApiError.network
    }
  }
}
