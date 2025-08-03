#!/usr/bin/env python3
"""
Startup script for GitLab ↔ Google Sheets Sync Setup UI
This script starts both the Flask API server and the simple HTTP server for the HTML UI.
"""

import subprocess
import sys
import time
import threading
import config

def start_flask_server():
    """Start the Flask API server"""
    print("🚀 Starting Flask API server...")
    try:
        subprocess.run([sys.executable, 'column_manager_api.py'], check=True)
    except KeyboardInterrupt:
        print("\n⏹️ Flask server stopped")
    except Exception as e:
        print(f"❌ Error starting Flask server: {e}")

def start_http_server():
    """Start the simple HTTP server for the HTML UI"""
    print("🌐 Starting HTTP server for UI...")
    try:
        # Use configurable port from config
        port = 8000  # Default port
        if hasattr(config, 'UI_SERVER_URL'):
            # Extract port from UI_SERVER_URL if available
            try:
                port = int(config.UI_SERVER_URL.split(':')[-1])
            except:
                port = 8000
        
        subprocess.run([sys.executable, '-m', 'http.server', str(port)], check=True)
    except KeyboardInterrupt:
        print("\n⏹️ HTTP server stopped")
    except Exception as e:
        print(f"❌ Error starting HTTP server: {e}")

def main():
    print("🎯 GitLab ↔ Google Sheets Sync Setup UI")
    print("=" * 50)
    print()
    print("📋 This will start:")
    print(f"   • Flask API Server: {config.API_SERVER_URL}")
    print(f"   • HTTP UI Server: {config.UI_SERVER_URL}")
    print()
    print("🌐 Access the setup UI at:")
    print(f"   {config.UI_SERVER_URL}/setup_ui.html")
    print()
    print("⚙️ Configuration:")
    print(f"   • API Server: {config.API_SERVER_URL}")
    print(f"   • UI Server: {config.UI_SERVER_URL}")
    print()
    print("💡 For server deployment:")
    print("   1. Update API_SERVER_URL in .env file")
    print("   2. Update UI_SERVER_URL in .env file")
    print("   3. Update API_BASE_URL in setup_ui.html")
    print()
    print("🔄 Starting servers...")
    print()

    # Start Flask server in a separate thread
    flask_thread = threading.Thread(target=start_flask_server, daemon=True)
    flask_thread.start()

    # Give Flask server time to start
    time.sleep(2)

    # Start HTTP server in main thread
    start_http_server()

if __name__ == "__main__":
    main() 