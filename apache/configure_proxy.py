"""Met a jour uniquement les blocs VirtualHost du domaine demande."""
import argparse
import pathlib
import re

def configure(directory, backup, domain, port):
    directory, backup = pathlib.Path(directory), pathlib.Path(backup)
    backup.mkdir(parents=True, exist_ok=True)
    changed = []
    pattern = re.compile(r'<VirtualHost\b[^>]*>.*?</VirtualHost>', re.I | re.S)
    target = re.compile(r'^\s*ServerName\s+' + re.escape(domain) + r'\s*$', re.I | re.M)
    directives = (f'    ProxyRequests Off\n    ProxyPreserveHost On\n    ProxyTimeout 120\n'
                  '    RequestHeader set X-Forwarded-Proto "expr=%{REQUEST_SCHEME}"\n'
                  f'    ProxyPass / http://127.0.0.1:{port}/ connectiontimeout=5 timeout=120\n'
                  f'    ProxyPassReverse / http://127.0.0.1:{port}/\n')
    for path in sorted(directory.glob('*.conf')):
        original = path.read_text()
        matched = False
        def update(match):
            nonlocal matched
            block = match.group(0)
            if not target.search(block):
                return block
            matched = True
            # Certificats, redirections et autres domaines restent inchanges.
            block = re.sub(r'^\s*(?:ProxyRequests|ProxyPreserveHost|ProxyTimeout)\s+[^\n]*\n', '', block, flags=re.I | re.M)
            block = re.sub(r'^\s*RequestHeader\s+set\s+X-Forwarded-Proto\s+[^\n]*\n', '', block, flags=re.I | re.M)
            block = re.sub(r'^\s*ProxyPass(?:Reverse)?\s+/\s+[^\n]*\n', '', block, flags=re.I | re.M)
            return target.sub(lambda m: m.group(0).rstrip() + '\n' + directives, block, count=1)
        result = pattern.sub(update, original)
        if matched:
            if path.is_symlink():
                raise RuntimeError(f'Configuration symlink {path} : verifier sa cible avant modification.')
            (backup / path.name).write_text(original)
            path.write_text(result)
            changed.append(path.name)
    if not changed:
        name = f'ukit-{domain}.conf'
        (backup / (name + '.absent')).touch()
        (directory / name).write_text(f'# Managed by ukit deploy.sh\n<VirtualHost *:80>\n    ServerName {domain}\n{directives}</VirtualHost>\n')
        changed.append(name)
    return changed

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', default='/etc/apache2/sites-available')
    parser.add_argument('--backup', required=True)
    parser.add_argument('--domain', required=True)
    parser.add_argument('--port', required=True, type=int)
    args = parser.parse_args()
    for name in configure(args.directory, args.backup, args.domain, args.port):
        print(name)
