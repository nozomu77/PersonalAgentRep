import Foundation
import AuthenticationServices
import CryptoKit

@MainActor
class GoogleAuthManager: NSObject, ObservableObject {
    @Published var isAuthenticated = false
    @Published var userEmail: String?
    @Published var errorMessage: String?

    private var currentToken: OAuthToken?
    private var codeVerifier: String?
    private var authContinuation: CheckedContinuation<URL, Error>?

    private let keychainService = "com.iPhoneAIAgent.oauth"

    override init() {
        super.init()
        loadTokenFromKeychain()
    }

    // MARK: - 認証フロー (PKCE)

    func signIn() async {
        do {
            let token = try await performOAuthFlow()
            currentToken = token
            isAuthenticated = true
            saveTokenToKeychain(token)
            errorMessage = nil
        } catch {
            errorMessage = "ログインに失敗しました: \(error.localizedDescription)"
            isAuthenticated = false
        }
    }

    func signOut() {
        currentToken = nil
        isAuthenticated = false
        userEmail = nil
        deleteTokenFromKeychain()
    }

    // MARK: - アクセストークン取得

    func getAccessToken() async throws -> String {
        guard var token = currentToken else {
            throw AuthError.notAuthenticated
        }

        if token.isExpired {
            token = try await refreshAccessToken(token)
            currentToken = token
            saveTokenToKeychain(token)
        }

        return token.accessToken
    }

    // MARK: - OAuth リダイレクト処理

    func handleRedirect(url: URL) {
        authContinuation?.resume(returning: url)
        authContinuation = nil
    }

    // MARK: - OAuth フロー実装

    private func performOAuthFlow() async throws -> OAuthToken {
        // PKCE: code_verifier と code_challenge を生成
        let verifier = generateCodeVerifier()
        codeVerifier = verifier
        let challenge = generateCodeChallenge(from: verifier)

        // 認可URL構築
        var components = URLComponents(string: GoogleConfig.authEndpoint)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: GoogleConfig.clientID),
            URLQueryItem(name: "redirect_uri", value: GoogleConfig.redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: GoogleConfig.scopes.joined(separator: " ")),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent")
        ]

        guard let authURL = components.url else {
            throw AuthError.invalidURL
        }

        // ASWebAuthenticationSession でブラウザ認証
        let callbackURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: GoogleConfig.urlScheme
            ) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: AuthError.cancelled)
                }
            }
            session.prefersEphemeralWebBrowserSession = false
            session.presentationContextProvider = self
            session.start()
        }

        // 認可コードを取得
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
            throw AuthError.noAuthCode
        }

        // トークン交換
        return try await exchangeCodeForToken(code: code, verifier: verifier)
    }

    private func exchangeCodeForToken(code: String, verifier: String) async throws -> OAuthToken {
        var request = URLRequest(url: URL(string: GoogleConfig.tokenEndpoint)!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let params = [
            "code": code,
            "client_id": GoogleConfig.clientID,
            "redirect_uri": GoogleConfig.redirectURI,
            "grant_type": "authorization_code",
            "code_verifier": verifier
        ]

        request.httpBody = params
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AuthError.tokenExchangeFailed
        }

        var token = try JSONDecoder().decode(OAuthToken.self, from: data)
        token.expirationDate = Date().addingTimeInterval(TimeInterval(token.expiresIn))
        return token
    }

    private func refreshAccessToken(_ token: OAuthToken) async throws -> OAuthToken {
        guard let refreshToken = token.refreshToken else {
            throw AuthError.noRefreshToken
        }

        var request = URLRequest(url: URL(string: GoogleConfig.tokenEndpoint)!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let params = [
            "refresh_token": refreshToken,
            "client_id": GoogleConfig.clientID,
            "grant_type": "refresh_token"
        ]

        request.httpBody = params
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AuthError.tokenRefreshFailed
        }

        var newToken = try JSONDecoder().decode(OAuthToken.self, from: data)
        newToken.expirationDate = Date().addingTimeInterval(TimeInterval(newToken.expiresIn))
        // リフレッシュトークンは引き継ぐ
        if newToken.refreshToken == nil {
            newToken = OAuthToken(
                accessToken: newToken.accessToken,
                refreshToken: refreshToken,
                expiresIn: newToken.expiresIn,
                tokenType: newToken.tokenType,
                scope: newToken.scope,
                expirationDate: newToken.expirationDate
            )
        }
        return newToken
    }

    // MARK: - PKCE ヘルパー

    private func generateCodeVerifier() -> String {
        var buffer = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, buffer.count, &buffer)
        return Data(buffer).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func generateCodeChallenge(from verifier: String) -> String {
        let data = Data(verifier.utf8)
        let hash = SHA256.hash(data: data)
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    // MARK: - Keychain

    private func saveTokenToKeychain(_ token: OAuthToken) {
        guard let data = try? JSONEncoder().encode(token) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "oauth_token"
        ]

        SecItemDelete(query as CFDictionary)

        var addQuery = query
        addQuery[kSecValueData as String] = data
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    private func loadTokenFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "oauth_token",
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecSuccess,
           let data = result as? Data,
           let token = try? JSONDecoder().decode(OAuthToken.self, from: data) {
            currentToken = token
            isAuthenticated = true
        }
    }

    private func deleteTokenFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "oauth_token"
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension GoogleAuthManager: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        ASPresentationAnchor()
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case notAuthenticated
    case invalidURL
    case cancelled
    case noAuthCode
    case tokenExchangeFailed
    case tokenRefreshFailed
    case noRefreshToken

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "ログインが必要です"
        case .invalidURL: return "無効なURLです"
        case .cancelled: return "ログインがキャンセルされました"
        case .noAuthCode: return "認可コードが取得できませんでした"
        case .tokenExchangeFailed: return "トークンの交換に失敗しました"
        case .tokenRefreshFailed: return "トークンの更新に失敗しました"
        case .noRefreshToken: return "リフレッシュトークンがありません"
        }
    }
}
