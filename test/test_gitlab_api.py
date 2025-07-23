#!/usr/bin/env python3
"""
GitLab API Test Script
Tests the GitLab API endpoints with the correct format
"""

import requests
import json
import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config


def test_get_issues():
    """Test getting GitLab issues"""
    print("🔍 Testing GET issues...")
    
    url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues"
    headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"📊 Status Code: {response.status_code}")
        print(f"🔗 Request URL: {url}")
        
        if response.status_code == 200:
            issues = response.json()
            print(f"✅ Success! Found {len(issues)} issues")
            if issues:
                first_issue = issues[0]
                print(f"📝 First issue: #{first_issue['iid']} - {first_issue['title']}")
            return True
        else:
            print(f"❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_create_issue(test_title="API Test Issue"):
    """Test creating a GitLab issue"""
    print(f"\n🔨 Testing CREATE issue: {test_title}")
    
    url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues"
    headers = {
        "PRIVATE-TOKEN": config.GITLAB_TOKEN,
        "Content-Type": "application/json"
    }
    
    data = {
        "title": test_title,
        "description": "This is a test issue created by the API test script.\n\n/assign @farhad.l@appigo.co\n/label ~test"
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        print(f"📊 Status Code: {response.status_code}")
        print(f"🔗 Request URL: {url}")
        print(f"📤 Request Data: {json.dumps(data, indent=2)}")
        
        if response.status_code == 201:
            issue_data = response.json()
            issue_id = issue_data['iid']
            print(f"✅ Success! Created issue #{issue_id}")
            print(f"🔗 Issue URL: {issue_data.get('web_url', 'N/A')}")
            return issue_id
        else:
            print(f"❌ Failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_update_issue(issue_id, new_title=None, state_event=None):
    """Test updating a GitLab issue"""
    action = "update"
    if state_event == "close":
        action = "close"
    elif state_event == "reopen":
        action = "reopen"
    
    print(f"\n✏️ Testing {action.upper()} issue #{issue_id}")
    
    url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues/{issue_id}"
    headers = {
        "PRIVATE-TOKEN": config.GITLAB_TOKEN,
        "Content-Type": "application/json"
    }
    
    data = {}
    if new_title:
        data["title"] = new_title
    if state_event:
        data["state_event"] = state_event
    
    if not data:
        print("⚠️ No update data provided")
        return False
    
    try:
        response = requests.put(url, headers=headers, json=data, timeout=30)
        print(f"📊 Status Code: {response.status_code}")
        print(f"🔗 Request URL: {url}")
        print(f"📤 Request Data: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200:
            issue_data = response.json()
            print(f"✅ Success! Issue #{issue_id} {action}d")
            print(f"📝 Current state: {issue_data.get('state', 'N/A')}")
            return True
        else:
            print(f"❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all API tests"""
    print("🚀 GitLab API Test Suite")
    print("=" * 50)
    
    # Test configuration
    try:
        print(f"🔧 Configuration:")
        print(f"   GitLab URL: {config.GITLAB_URL}")
        print(f"   Project ID: {config.PROJECT_ID}")
        print(f"   Token: {config.GITLAB_TOKEN[:8]}...")
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        print("💡 Make sure you have a .env file with the required values")
        return
    
    # Test 1: Get issues
    get_success = test_get_issues()
    
    if not get_success:
        print("\n❌ GET test failed - stopping here")
        return
    
    # Test 2: Create issue
    test_issue_id = test_create_issue("🧪 API Test Issue - Created by test script")
    
    if not test_issue_id:
        print("\n❌ CREATE test failed - stopping here")
        return
    
    # Test 3: Update issue title
    update_success = test_update_issue(
        test_issue_id, 
        new_title="🧪 API Test Issue - UPDATED by test script"
    )
    
    if not update_success:
        print(f"\n❌ UPDATE test failed for issue #{test_issue_id}")
    
    # Test 4: Close issue
    close_success = test_update_issue(test_issue_id, state_event="close")
    
    if not close_success:
        print(f"\n❌ CLOSE test failed for issue #{test_issue_id}")
    
    # Summary
    print("\n" + "=" * 50)
    if get_success and test_issue_id and update_success and close_success:
        print("🎉 All tests passed!")
        print(f"✅ Test issue #{test_issue_id} was created, updated, and closed successfully")
        print("🔥 Your GitLab API configuration is working perfectly!")
    else:
        print("⚠️ Some tests failed - check the output above")
    
    print(f"\n🔗 View all issues: {config.GITLAB_URL.rstrip('/')}/projects/{config.PROJECT_ID}/issues")

if __name__ == "__main__":
    main() 