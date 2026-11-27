"""Run against the same local Supabase and Mailpit setup as profile_smoke.py."""
import os
import secrets
from playwright.sync_api import expect, sync_playwright
from profile_smoke import app, register


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.getenv("CHROMIUM_PATH"))
        owner_page = browser.new_page()
        owner = register(owner_page, f"rank-{secrets.token_hex(8)}@example.test", secrets.token_urlsafe(18))
        # Use the normal answer handler, including its double-submit protection.
        owner_page.evaluate("""()=>{
          go('write');
          const s=cur(), d=s.order[0];
          s.state[0].typed={latin:d[4].split(' (')[0],dose:d[1],group:d[3]};
          check();check();
        }""")
        owner_page.evaluate("""async()=>{await syncStudy(studyOwner());go('profile')}""")
        expect(owner_page.locator("#studyPanel small")).to_have_text("По всем устройствам")
        expect(owner_page.locator("#studyPanel dd")).to_have_text(["1", "1 день", "0"])
        summary = owner_page.evaluate("""async()=>{
          const owner=studyOwner(),run_id=studyRunId();
          const records=[['2024-04-01',true],['2024-04-02',true],['2024-04-03',true],['2024-04-03',false]];
          const answers=records.map(([study_day,correct],question)=>({run_id,question,study_day,correct,written:false}));
          const args={account:owner,answers};
          const first=await profileAuth.studyRpc('submit_study_answers',args,owner);
          const repeat=await profileAuth.studyRpc('submit_study_answers',args,owner);
          const [totals]=await profileAuth.studyRpc('my_study_stats',{},owner);
          return {first,repeat,totals};
        }""")
        assert summary == {"first": 4, "repeat": 0, "totals": {"recipes": 1, "streak": 2, "mistakes": 1}}
        public = browser.new_page()
        public.goto(app)
        public.get_by_role("button", name="Рейтинг", exact=True).click()
        expect(public.locator(".rank-podium")).to_contain_text("Участник")
        public.get_by_role("button", name="Серия", exact=True).click()
        expect(public.locator(".rank-podium")).to_contain_text("2 дня")
        second = browser.new_page()
        register(second, f"rank-{secrets.token_hex(8)}@example.test", secrets.token_urlsafe(18))
        allowed = second.evaluate("""async owner=>{
          try{await profileAuth.studyRpc('submit_study_answers',{account:owner,answers:[]});return true}
          catch{return false}
        }""", owner)
        assert not allowed
        assert second.evaluate("profileAuth.studyRpc('my_study_stats',{})") == []
        browser.close()
    print("PASS: built-in answer, idempotency, streaks, public ranking and ownership")


if __name__ == "__main__":
    main()
