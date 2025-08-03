#!/usr/bin/env python3
"""
Demo script to show the GitLab ↔ Google Sheets Sync Web UI
This script provides a simple way to launch the web interface
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    print("🎯 GitLab ↔ Google Sheets Sync - Web UI Demo")
    print("=" * 50)
    print()
    
    # Get the web UI directory
    script_dir = Path(__file__).parent
    web_ui_dir = script_dir / "web_ui"
    
    if not web_ui_dir.exists():
        print("❌ Web UI directory not found!")
        print("Make sure you're running this from the project root directory.")
        return 1
    
    print("📁 Web UI location:", web_ui_dir)
    print()
    
    # Check Python installation
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 7):
        print("❌ Python 3.7+ is required")
        print(f"Current version: {python_version.major}.{python_version.minor}")
        return 1
    
    print("✅ Python version:", f"{python_version.major}.{python_version.minor}")
    print()
    
    # Show launch options
    print("🚀 Launch Options:")
    print()
    print("1. Automatic Setup & Launch (Recommended)")
    print("   cd web_ui && python run.py")
    print()
    print("2. Shell Script (Linux/macOS)")
    print("   cd web_ui && ./start.sh")
    print()
    print("3. Manual Flask Launch")
    print("   cd web_ui && python app.py")
    print()
    
    # Ask user preference
    choice = input("Choose launch method (1/2/3) or Enter to use automatic: ").strip()
    
    if choice == "2":
        # Shell script
        start_script = web_ui_dir / "start.sh"
        if start_script.exists():
            print("🎯 Launching with shell script...")
            os.chdir(web_ui_dir)
            return subprocess.call(["./start.sh"])
        else:
            print("❌ start.sh not found")
            return 1
    
    elif choice == "3":
        # Manual Flask
        app_file = web_ui_dir / "app.py"
        if app_file.exists():
            print("🎯 Launching Flask app manually...")
            os.chdir(web_ui_dir)
            return subprocess.call([sys.executable, "app.py"])
        else:
            print("❌ app.py not found")
            return 1
    
    else:
        # Automatic (default)
        run_script = web_ui_dir / "run.py"
        if run_script.exists():
            print("🎯 Launching with automatic setup...")
            os.chdir(web_ui_dir)
            return subprocess.call([sys.executable, "run.py"])
        else:
            print("❌ run.py not found")
            return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code or 0)
    except KeyboardInterrupt:
        print("\n\n👋 Cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
