"""End-to-end check against a loopback-only app, Supabase and Mailpit."""
import json
import os
import re
import secrets
import time
from urllib.parse import urlsplit
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


def local_url(variable, default):
    value = os.getenv(variable, default).rstrip("/")
    if urlsplit(value).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError(f"{variable} must point to localhost")
    return value


app = local_url("PROFILE_TEST_APP", "http://127.0.0.1:3000")
mail = local_url("PROFILE_TEST_MAIL", "http://127.0.0.1:54324")
seen = set()


def inbox(path):
    with urlopen(mail + "/api/v1/" + path, timeout=5) as response:
        return json.load(response)


def mail_code(email, heading):
    for _ in range(50):
        for message in inbox("messages")["messages"]:
            if message["ID"] in seen or email not in [to["Address"] for to in message["To"]]:
                continue
            body = inbox("message/" + message["ID"])["HTML"]
            if heading in body:
                seen.add(message["ID"])
                return re.search(r"<strong>([0-9]{6})</strong>", body).group(1)
        time.sleep(0.2)
    raise AssertionError("Expected verification email was not delivered")


def click(page, label):
    page.get_by_role("button", name=label, exact=True).click()


def fill(page, **fields):
    for name, value in fields.items():
        page.locator(f'[name="{name}"]').fill(value)


def submit(page):
    page.locator('[type="submit"]').click()


def register(page, email, password):
    page.goto(app)
    assert page.evaluate("profileAuth.remote === true")
    assert urlsplit(page.evaluate("profileServer.url")).hostname in {"127.0.0.1", "localhost", "::1"}
    click(page, "Профиль")
    click(page, "Создать профиль")
    fill(page, name="Участник", email=email, password=password)
    submit(page)
    expect(page.locator("h1")).to_have_text("Введите код")
    page.reload()
    expect(page.locator(".profile-demo strong")).to_have_count(0)
    code = mail_code(email, "Подтвердите почту")
    fill(page, code="000000" if code != "000000" else "000001")
    submit(page)
    expect(page.get_by_role("alert")).to_be_visible()
    fill(page, code=code)
    submit(page)
    expect(page.locator(".profile-identity")).to_contain_text(email)
    return page.evaluate("profileAuth.current().id")


def profile_request(page, method, user_id, authenticated=True):
    return page.evaluate("""async ([method,id,signed])=>{
      const headers={apikey:profileServer.publishableKey};
      if(signed) headers.Authorization='Bearer '+JSON.parse(localStorage[profileAuth.sessionKey]).access_token;
      const options={method,headers};
      if(method==='PATCH'){
        headers.Prefer='return=representation'; headers['Content-Type']='application/json';
        options.body=JSON.stringify({name:'Чужой профиль'});
      }
      const response=await fetch(profileServer.url+'/rest/v1/profiles?id=eq.'+id,options);
      return [response.status,await response.json()];
    }""", [method, user_id, authenticated])


def main():
    email = f"profile-{secrets.token_hex(8)}@example.test"
    second_email = f"profile-{secrets.token_hex(8)}@example.test"
    password, replacement = secrets.token_urlsafe(20), secrets.token_urlsafe(20)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.getenv("CHROMIUM_PATH"))
        first, second = browser.new_page(), browser.new_page()
        errors = []
        for page in (first, second):
            page.on("pageerror", lambda error: errors.append(str(error)))
        owner = register(first, email, password)
        click(first, "Редактировать профиль")
        fill(first, name="Анна Петрова", nick="anna")
        submit(first)
        expect(first.locator(".profile-identity")).to_contain_text("@anna")
        register(second, second_email, password)
        for method in ("GET", "PATCH"):
            assert profile_request(second, method, owner) == [200, []]
            assert profile_request(second, method, owner, False)[0] in (401, 403)
        click(second, "Выйти из профиля")
        fill(second, email=email, password=password)
        submit(second)
        expect(second.locator(".profile-identity")).to_contain_text("Анна Петрова")
        click(second, "Выйти из профиля")
        click(second, "Забыли пароль?")
        fill(second, email=email)
        submit(second)
        fill(second, code=mail_code(email, "Восстановление пароля"))
        submit(second)
        fill(second, password=replacement)
        submit(second)
        fill(second, email=email, password=password)
        submit(second)
        expect(second.get_by_role("alert")).to_contain_text("Проверьте")
        fill(second, password=replacement)
        submit(second)
        expect(second.locator(".profile-avatar")).to_have_text("АП")
        assert not errors, errors
        browser.close()
    print("PASS: signup, confirmation email, profile edits, owner-only access, second browser, password recovery")


if __name__ == "__main__":
    main()
