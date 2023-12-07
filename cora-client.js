/**
 * Classe CoraClient
 * Desenvolvido por Renan Moreira em 06/12/2023
 * Áreum Tecnologia - renan.moreira@areum.com.br
 * Descrição: Classe desenvolvida para facilitar a integracao entre aplicacoes e os recursos disponibilizados pela API do banco Cora. Atualmente permite autenticacao e gerenciamento de invoices (boletos)
 */
const https = require('https');

class CoraClient {
    constructor(clientId, certHash, privateKeyHash, isProduction = false, isDirectIntegration = true) {
        this.clientId = clientId;
        this.certFile = certHash;
        this.privateKey = privateKeyHash;
        this.baseUrl = isDirectIntegration ? isProduction ? 'https://matls-clients.api.cora.com.br/' : 'https://matls-clients.api.stage.cora.com.br/' : isProduction ? 'https://api.cora.com.br/' : 'https://api.stage.cora.com.br/';
        this.token = null;
    }

    async authenticate() {
        const data = `grant_type=client_credentials&client_id=${this.clientId}`;
        const url = new URL(this.baseUrl + 'token');
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length
            },
            key: this.privateKey,
            cert: this.certFile
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let response = '';
                res.on('data', (chunk) => response += chunk);
                res.on('end', () => {
                    try {
                        this.token = JSON.parse(response).access_token;
                        resolve(this.token);
                    } catch {
                        this.token = null;
                        resolve(response);
                    }

                });
            });

            req.on('error', (e) => reject(e));
            req.write(data);
            req.end();
        });
    }

    async makeRequest(endpoint, method, body = null, headerOptions = {}) {
        if (!this.token) {
            await this.authenticate();
        }

        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + endpoint);
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    ...headerOptions,
                },
                key: this.privateKey,
                cert: this.certFile
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }

                    if (![200, 204].includes(res.statusCode)) {
                        console.log(new Date().toLocaleString(), res.statusCode, res.statusMessage, data);
                    }
                });
            });

            req.on('error', (e) => reject(e));

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }

    registerInvoice(IdempotencyKey, invoiceData) {
        return this.makeRequest('invoices/', 'POST', invoiceData, { 'Idempotency-Key': IdempotencyKey });
    }

    listInvoices(params = {}) {
        const queryParams = new URLSearchParams(params).toString();
        const endpoint = `invoices/${queryParams ? '?' + queryParams : ''}`;
        return this.makeRequest(endpoint, 'GET');
    }

    getInvoiceDetails(invoiceId) {
        return this.makeRequest(`invoices/${invoiceId}`, 'GET');
    }

    cancelInvoice(invoiceId) {
        return this.makeRequest(`invoices/${invoiceId}`, 'DELETE');
    }

    issueInstallmentPlan(installmentPlanData) {
        return this.makeRequest('carnes/', 'POST', installmentPlanData);
    }
}

module.exports = CoraClient;
