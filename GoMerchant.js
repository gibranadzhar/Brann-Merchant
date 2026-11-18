const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

class GoMerchant {
    constructor() {
        this.baseUrl = 'https://api.gobiz.co.id';
        this.clientId = 'go-biz-web-new';
        this.appId = 'go-biz-web-dashboard';
        this.uniqueId = uuidv4();
        this.appVersion = 'platform-v3.131.0-93e290ae';
        this.lastVersionCheck = 0;
        this.fetchLatestAppVersion();
    }

    async fetchLatestAppVersion() {
        if (Date.now() - this.lastVersionCheck < 12 * 60 * 60 * 1000) return this.appVersion;
        try {
            const res = await axios.get('https://portal.gofoodmerchant.co.id/login', {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
                }
            });
            const m = res.data && typeof res.data === 'string' && res.data.match(/"REACT_APP_DOCKER_IMAGE_TAG":"(platform-v[^"]+)"/);
            if (m && m[1]) {
                this.appVersion = m[1];
                this.lastVersionCheck = Date.now();
                console.log(`🚀 [GoMerchant] Updated app version to official GoBiz portal tag: ${this.appVersion}`);
            }
        } catch (e) {
            // Silently retain fallback version
        }
        return this.appVersion;
    }

    headers(token = null, customUniqueId = null, clientIp = null) {
        const h = {
            'Accept': 'application/json, text/plain, */*',
            'Authentication-Type': 'go-id',
            'X-PhoneMake': 'Windows',
            'X-PhoneModel': 'Chrome',
            'x-DeviceOS': 'Web',
            'X-Platform': 'Web',
            'X-User-Type': 'merchant',
            'x-appId': this.appId,
            'x-uniqueid': customUniqueId || this.uniqueId,
            'X-AppVersion': this.appVersion || 'platform-v3.131.0-93e290ae',
            'Gojek-Country-Code': 'ID',
            'Gojek-Timezone': 'Asia/Jakarta',
            'Accept-Language': 'id',
            'X-User-Locale': 'id-ID',
            'Origin': 'https://portal.gofoodmerchant.co.id',
            'Referer': 'https://portal.gofoodmerchant.co.id/',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        };
        if (clientIp) {
            h['X-Forwarded-For'] = clientIp;
            h['CF-Connecting-IP'] = clientIp;
            h['True-Client-IP'] = clientIp;
        }
        if (token) h['Authorization'] = `Bearer ${token}`;
        return h;
    }

    cleanPhoneNumber(phone) {
        if (!phone) return '';
        let cleaned = String(phone).trim().replace(/\D/g, '');
        if (cleaned.startsWith('62')) {
            cleaned = cleaned.slice(2);
        }
        while (cleaned.startsWith('0')) {
            cleaned = cleaned.slice(1);
        }
        return cleaned;
    }

    convertCRC16(str) {
        let crc = 0xFFFF;
        const strlen = str.length;
        for (let c = 0; c < strlen; c++) {
            crc ^= str.charCodeAt(c) << 8;
            for (let i = 0; i < 8; i++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc = crc << 1;
                }
            }
        }
        let hex = crc & 0xFFFF;
        hex = ("000" + hex.toString(16).toUpperCase()).slice(-4);
        return hex;
    }

    async createDynamicQRIS(amount, staticQr) {
        try {
            let qrisData = staticQr;
            qrisData = qrisData.slice(0, -4);
            const step1 = qrisData.replace("010211", "010212");
            const step2 = step1.split("5802ID");
            const amountStr = amount.toString();
            let uang = "54" + ("0" + amountStr.length).slice(-2) + amountStr;
            uang += "5802ID";
            const result = step2[0] + uang + step2[1] + this.convertCRC16(step2[0] + uang + step2[1]);
            const qrCodeBuffer = await QRCode.toBuffer(result);
            return {
                qr_buffer: qrCodeBuffer,
                qr_string: result,
                amount: amount,
                created_at: new Date().toISOString()
            };
        } catch (error) {
            throw error;
        }
    }

    async requestOtp(phoneNumber, clientIp = null) {
        await this.fetchLatestAppVersion();
        const cleanPhone = this.cleanPhoneNumber(phoneNumber);
        if (!cleanPhone || cleanPhone.length < 8) {
            throw new Error('Format nomor HP tidak valid. Contoh: 08123456789 atau 628123456789');
        }
        const payload = {
            client_id: this.clientId,
            phone_number: cleanPhone,
            country_code: '62'
        };
        const response = await axios.post(`${this.baseUrl}/goid/login/request`, payload, {
            headers: this.headers(null, null, clientIp)
        });
        return response.data;
    }

    async verifyOtp(otp, otpToken, clientIp = null) {
        await this.fetchLatestAppVersion();
        const payload = {
            client_id: this.clientId,
            data: {
                otp: otp,
                otp_token: otpToken
            },
            grant_type: 'otp'
        };
        const response = await axios.post(`${this.baseUrl}/goid/token`, payload, {
            headers: this.headers(null, null, clientIp)
        });
        return response.data;
    }

    async refreshToken(refreshToken, clientIp = null) {
        await this.fetchLatestAppVersion();
        const payload = {
            client_id: this.clientId,
            grant_type: 'refresh_token',
            data: {
                refresh_token: refreshToken
            }
        };
        const response = await axios.post(`${this.baseUrl}/goid/token`, payload, {
            headers: this.headers(null, this.uniqueId, clientIp)
        });
        return response.data;
    }

    async getMe(accessToken) {
        const response = await axios.get(`${this.baseUrl}/v1/users/me`, {
            headers: this.headers(accessToken)
        });
        return response.data;
    }

    async getPayouts(accessToken) {
        const response = await axios.get(`${this.baseUrl}/v1/merchants/payouts?page=1&per=50`, {
            headers: this.headers(accessToken)
        });
        return response.data;
    }

    async getJournals(accessToken, merchantId, startTime = null) {
        const dateTo = new Date().toISOString();
        const dateFrom = startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const payload = {
            from: 0,
            size: 50,
            sort: { time: { order: 'desc' } },
            included_categories: { incoming: ['transaction_share', 'action'] },
            query: [{
                clauses: [
                    { field: 'metadata.transaction.status', op: 'in', value: ['settlement', 'capture'] },
                    { field: 'metadata.transaction.transaction_time', op: 'gte', value: dateFrom },
                    { field: 'metadata.transaction.transaction_time', op: 'lte', value: dateTo },
                    { field: 'metadata.transaction.merchant_id', op: 'equal', value: merchantId }
                ],
                op: 'and'
            }]
        };
        const response = await axios.post(`${this.baseUrl}/journals/search`, payload, {
            headers: {
                ...this.headers(accessToken),
                'accept': 'application/vnd.journal.v1+json'
            }
        });
        return response.data;
    }
}

module.exports = GoMerchant;
