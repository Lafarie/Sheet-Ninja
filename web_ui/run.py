"""
GitLab ↔ Google Sheets Sync Web UI
Simple launcher script for the web interface
"""

import os
import sys
import subprocess
import webbrowser
import time
from pathlib import Path

def main():
    """Launch the web UI with proper setup"""
    
    print("🚀 GitLab ↔ Google Sheets Sync Web UI Launcher")
    print("=" * 50)
    
    # Get project paths
    current_dir = Path(__file__).parent
    project_root = current_dir.parent
    
    print(f"📁 Project root: {project_root}")
    print(f"🌐 Web UI directory: {current_dir}")
    
    # Check if virtual environment exists
    venv_dir = project_root / "venv"
    if not venv_dir.exists():
        print("📦 Creating virtual environment...")
        subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
    
    # Determine the correct Python executable
    if os.name == 'nt':  # Windows
        python_exe = venv_dir / "Scripts" / "python.exe"
        pip_exe = venv_dir / "Scripts" / "pip.exe"
    else:  # Unix/Linux/macOS
        python_exe = venv_dir / "bin" / "python"
        pip_exe = venv_dir / "bin" / "pip"
    
    # Install/upgrade requirements
    print("📦 Installing requirements...")
    subprocess.run([str(pip_exe), "install", "--upgrade", "pip"], check=True)
    subprocess.run([str(pip_exe), "install", "-r", str(current_dir / "requirements.txt")], check=True)
    
    # Check for .env file
    env_file = project_root / ".env"
    if not env_file.exists():
        env_example = project_root / "env.example"
        if env_example.exists():
            print("⚠️  Creating .env file from template...")
            import shutil
            shutil.copy(env_example, env_file)
            print(f"📋 Please edit {env_file} with your configuration")
        else:
            print("❌ No env.example template found")
    
    # Check for service account file
    service_account = project_root / "service_account.json"
    if not service_account.exists():
        print("⚠️  No service_account.json found")
        print(f"💡 Please download your Google Service Account key to: {service_account}")
    
    print("\n✅ Setup complete!")
    print("\n🌐 Starting web server...")
    print("📱 The web interface will be available at:")
    print("   Local:    http://localhost:5001")
    print("\nPress Ctrl+C to stop the server")
    print("-" * 50)
    
    # Start the Flask app
    try:
        # Change to web UI directory
        os.chdir(current_dir)
        
        # Start Flask app
        env = os.environ.copy()
        env['FLASK_APP'] = 'app.py'
        env['FLASK_ENV'] = 'development'
        env['FLASK_DEBUG'] = '1'
        
        # Open browser after a short delay
        def open_browser():
            time.sleep(2)
            try:
                webbrowser.open('http://localhost:5001')
            except:
                pass
        
        import threading
        threading.Thread(target=open_browser, daemon=True).start()
        
        # Start the app
        subprocess.run([str(python_exe), "app.py"], env=env)
        
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down web server...")
    except Exception as e:
        print(f"\n❌ Error starting web server: {e}")
        print("💡 Try running the start.sh script instead")

if __name__ == "__main__":
    main()
