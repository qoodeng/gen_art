import http.server
import socketserver
import webbrowser

PORT = 4002

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    print("Press Ctrl+C to stop the server.")
    # Browser auto-open removed as per user request
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
