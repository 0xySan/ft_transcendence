import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ quiet: true });

function createTransporter() {
	if (process.env.NODE_ENV !== 'test' && process.env.DKIM_KEY && fs.existsSync(process.env.DKIM_KEY)) {
		try {
			fs.readFileSync(process.env.DKIM_KEY, 'utf8');
		} catch (err) {
			console.error(`❌ DKIM key file is not readable: ${process.env.DKIM_KEY}`);
			return nodemailer.createTransport({
				jsonTransport: true
			});
		}
		return nodemailer.createTransport({
			host: 'host.docker.internal',
			port: 25,
			secure: false,
			tls: { rejectUnauthorized: false },
			dkim: {
				domainName: process.env.MAIL_DOMAIN || 'example.com',
				keySelector: 'mail',
				privateKey: fs.readFileSync(process.env.DKIM_KEY, 'utf8')
			}
		});
	} else {
			return nodemailer.createTransport({
				jsonTransport: true
			});
	}
}

const transporter = createTransporter();

/**
 * Load an email template from the filesystem.
 * @param templateName - Name of the template file to load
 * @returns Template content
 */
function loadTemplate(templateName: string): string {
	const filePath = path.join(process.cwd(), 'src', 'utils', 'mail', 'templates', templateName);
	if (!fs.existsSync(filePath)) {
		throw new Error(`Template not found: ${filePath}`);
	}
	return fs.readFileSync(filePath, 'utf8');
}

/**
 * Replace placeholders {{KEY}} in a template.
 * @param template - Template string
 * @param data - Key/value pairs for placeholders
 * @returns Filled template
 */
function fillTemplate(template: string, data: Record<string, string>): string {
	return Object.entries(data).reduce((result, [key, value]) => {
		const regex = new RegExp(`{{${key}}}`, 'g');
		return result.replace(regex, value);
	}, template);
}

/**
 * Send a generic email.
 *
 * @param to - Recipient email
 * @param subject - Email subject
 * @param templateName - Optional template file name (base HTML)
 * @param placeholders - Optional placeholders to fill template
 * @param from - Optional sender email (default: no-reply@MAIL_DOMAIN)
 */
export async function sendMail(
	to: string,
	subject: string,
	templateName?: string,
	placeholders?: Record<string, string>,
	from?: string
): Promise<void> {
	from = from || `no-reply@${process.env.MAIL_DOMAIN || 'example.com'}`;

	let html: string | undefined;
	if (templateName) {
		const base = loadTemplate('base.html');
		const content = loadTemplate(templateName);
		const filledContent = fillTemplate(content, placeholders || {});
		html = fillTemplate(base, {
			HEADER: placeholders?.HEADER || subject,
			CONTENT: filledContent,
		});
	}

	const message = {
		from,
		to,
		subject,
		html,
		text: placeholders?.TEXT || `Message from ${subject}`,
	};

	try {
		const info = await transporter.sendMail(message);
		console.log(`✅ Email sent to ${to}: ${info.response}`);
	} catch (err) {
		console.error(`❌ Failed to send email to ${to}:`, err);
		throw err;
	}
}
