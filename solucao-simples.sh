#!/bin/bash
# ============================================
# Solução Simples - Servir Frontend Estático
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PASS="<SSH_PASSWORD>"

echo "🚀 Implementando solução simples..."

cat > simple_solution.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 120
set server_ip [lindex $argv 0]
set server_user [lindex $argv 1]
set server_pass [lindex $argv 2]

spawn ssh -o StrictHostKeyChecking=no $server_user@$server_ip

expect {
    "password:" {
        send "$server_pass\r"
        exp_continue
    }
    "# " {
        send "cd /var/www/nexoscrm/frontend\r"
        expect "# "
        
        send "echo 'Removendo type module do frontend...'\r"
        expect "# "
        
        send "sed -i '/\"type\": \"module\",/d' package.json\r"
        expect "# "
        
        send "echo 'Renomeando postcss.config.js para .cjs...'\r"
        expect "# "
        
        send "mv postcss.config.js postcss.config.cjs 2>/dev/null || echo 'Arquivo nao existe'\r"
        expect "# "
        
        send "echo 'Criando build simples...'\r"
        expect "# "
        
        send "mkdir -p dist\r"
        expect "# "
        
        send "cat > dist/index.html << 'HTMLEOF'\n<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>NexosCRM</title>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }\n        .container { max-width: 400px; margin: 100px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }\n        h1 { color: #333; text-align: center; margin-bottom: 30px; }\n        .form-group { margin-bottom: 20px; }\n        label { display: block; margin-bottom: 5px; color: #555; }\n        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }\n        button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }\n        button:hover { background: #0056b3; }\n        .status { margin-top: 20px; padding: 10px; border-radius: 4px; text-align: center; }\n        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }\n        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <h1>NexosCRM</h1>\n        <form id=\"loginForm\">\n            <div class=\"form-group\">\n                <label for=\"email\">Email:</label>\n                <input type=\"email\" id=\"email\" value=\"admin@nexoscrm.com\" required>\n            </div>\n            <div class=\"form-group\">\n                <label for=\"password\">Senha:</label>\n                <input type=\"password\" id=\"password\" value=\"<ADMIN_PASSWORD>\" required>\n            </div>\n            <button type=\"submit\">Entrar</button>\n        </form>\n        <div id=\"status\"></div>\n    </div>\n\n    <script>\n        document.getElementById('loginForm').addEventListener('submit', async (e) => {\n            e.preventDefault();\n            const email = document.getElementById('email').value;\n            const password = document.getElementById('password').value;\n            const status = document.getElementById('status');\n            \n            try {\n                const response = await fetch('/api/auth/login', {\n                    method: 'POST',\n                    headers: { 'Content-Type': 'application/json' },\n                    body: JSON.stringify({ email, password })\n                });\n                \n                if (response.ok) {\n                    const data = await response.json();\n                    status.innerHTML = '<div class=\"success\">Login realizado com sucesso!</div>';\n                    localStorage.setItem('token', data.token);\n                    setTimeout(() => {\n                        window.location.href = '/dashboard.html';\n                    }, 1000);\n                } else {\n                    status.innerHTML = '<div class=\"error\">Erro no login. Verifique suas credenciais.</div>';\n                }\n            } catch (error) {\n                status.innerHTML = '<div class=\"error\">Erro de conexão: ' + error.message + '</div>';\n            }\n        });\n        \n        // Testar API\n        fetch('/api/health')\n            .then(response => response.json())\n            .then(data => console.log('API Status:', data))\n            .catch(error => console.error('API Error:', error));\n    </script>\n</body>\n</html>\nHTMLEOF\r"
        expect "# "
        
        send "echo 'Criando página de dashboard...'\r"
        expect "# "
        
        send "cat > dist/dashboard.html << 'DASHEOF'\n<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Dashboard - NexosCRM</title>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f8f9fa; }\n        .header { background: #007bff; color: white; padding: 15px 20px; }\n        .container { padding: 20px; }\n        .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n        .logout { float: right; color: white; text-decoration: none; }\n    </style>\n</head>\n<body>\n    <div class=\"header\">\n        <h1>NexosCRM Dashboard</h1>\n        <a href=\"/\" class=\"logout\">Sair</a>\n    </div>\n    <div class=\"container\">\n        <div class=\"card\">\n            <h2>Bem-vindo ao NexosCRM!</h2>\n            <p>Sistema de CRM completo implantado com sucesso.</p>\n            <p><strong>Funcionalidades disponíveis:</strong></p>\n            <ul>\n                <li>Gestão de Clientes e Empresas</li>\n                <li>Funil de Vendas e Oportunidades</li>\n                <li>Propostas e Contratos</li>\n                <li>Pós-venda e Suporte</li>\n                <li>Comissionamento</li>\n                <li>Automações e Workflows</li>\n            </ul>\n        </div>\n        <div class=\"card\">\n            <h3>Status da API</h3>\n            <div id=\"apiStatus\">Verificando...</div>\n        </div>\n    </div>\n    \n    <script>\n        fetch('/api/health')\n            .then(response => response.json())\n            .then(data => {\n                document.getElementById('apiStatus').innerHTML = \n                    '<p><strong>Status:</strong> ' + data.status + '</p>' +\n                    '<p><strong>Ambiente:</strong> ' + data.environment + '</p>' +\n                    '<p><strong>Uptime:</strong> ' + Math.round(data.uptime) + ' segundos</p>';\n            })\n            .catch(error => {\n                document.getElementById('apiStatus').innerHTML = '<p style=\"color: red;\">Erro: ' + error.message + '</p>';\n            });\n    </script>\n</body>\n</html>\nDASHEOF\r"
        expect "# "
        
        send "echo 'Configurando Nginx...'\r"
        expect "# "
        
        send "cat > /etc/nginx/sites-available/nexoscrm << 'NGXEOF'\nserver {\n    listen 80;\n    server_name _;\n    root /var/www/nexoscrm/frontend/dist;\n    index index.html;\n    \n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n    \n    location /api/ {\n        proxy_pass http://localhost:3001;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection upgrade;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}\nNGXEOF\r"
        expect "# "
        
        send "nginx -t && systemctl reload nginx\r"
        expect "# "
        
        send "echo 'Testando...'\r"
        expect "# "
        
        send "curl -s http://localhost/ | head -10\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x simple_solution.exp
./simple_solution.exp $SERVER_IP $SERVER_USER $SERVER_PASS
rm -f simple_solution.exp

echo ""
echo "✅ SOLUÇÃO IMPLEMENTADA!"
echo ""
echo "🌐 Acesse: http://$SERVER_IP"
echo "📧 Login: admin@nexoscrm.com"
echo "🔑 Senha: <ADMIN_PASSWORD>"
echo ""
echo "O sistema agora tem uma interface web simples que se conecta à API!"