import nodemailer from 'nodemailer'
import handlebars from 'handlebars'
import { readFileSync } from 'fs'
import { join } from 'path'
import settingsService from './settingsService'

interface EmailConfig {
  provider: 'smtp'
  smtp: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
  from: {
    name: string
    email: string
  }
  enabled: boolean
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

class EmailService {
  private transporter: any = null
  private templates: Map<string, EmailTemplate> = new Map()

  constructor() {
    this.loadTemplates()
  }

  private async getEmailConfig(): Promise<EmailConfig | null> {
    try {
      const settings = await settingsService.getAllSettings()
      
      if (!settings?.email?.enabled) {
        console.log('Email service is disabled in settings')
        return null
      }

      // Validate required fields
      if (!settings.email.from?.email) {
        console.error('Email from address is not configured')
        return null
      }

      return settings.email as EmailConfig
    } catch (error) {
      console.error('Failed to get email configuration:', error)
      return null
    }
  }

  private async createTransport(config: EmailConfig): Promise<any> {
    if (!config.smtp?.host || !config.smtp?.auth?.user) {
      throw new Error('SMTP configuration is incomplete')
    }
    return nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.auth.user,
        pass: config.smtp.auth.pass
      }
    })
  }

  private loadTemplates(): void {
    try {
      // Load email templates
      const templatesDir = join(process.cwd(), 'server', 'templates', 'email')
      
      // Invitation template
      const invitationHtml = this.loadTemplate(join(templatesDir, 'invitation.html'))
      const invitationText = this.loadTemplate(join(templatesDir, 'invitation.txt'))
      
      this.templates.set('invitation', {
        subject: 'Welcome to {{appName}} - Complete Your Account Setup',
        html: invitationHtml,
        text: invitationText
      })

      // Password reset template
      const passwordResetHtml = this.loadTemplate(join(templatesDir, 'password-reset.html'))
      const passwordResetText = this.loadTemplate(join(templatesDir, 'password-reset.txt'))
      
      this.templates.set('password-reset', {
        subject: 'Reset Your {{appName}} Password',
        html: passwordResetHtml,
        text: passwordResetText
      })

      // Welcome template
      const welcomeHtml = this.loadTemplate(join(templatesDir, 'welcome.html'))
      const welcomeText = this.loadTemplate(join(templatesDir, 'welcome.txt'))
      
      this.templates.set('welcome', {
        subject: 'Welcome to {{appName}}!',
        html: welcomeHtml,
        text: welcomeText
      })

    } catch (error) {
      console.error('Failed to load email templates:', error)
      // Create fallback templates
      this.createFallbackTemplates()
    }
  }

  private loadTemplate(filePath: string): string {
    try {
      return readFileSync(filePath, 'utf-8')
    } catch (error) {
      console.warn(`Template file not found: ${filePath}`)
      return ''
    }
  }

  private createFallbackTemplates(): void {
    // Fallback invitation template
    this.templates.set('invitation', {
      subject: 'Welcome to {{appName}} - Complete Your Account Setup',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome to {{appName}}!</h1>
          <p>Hello {{userName}},</p>
          <p>You've been invited to join {{appName}} by {{invitedByName}}.</p>
          <p>To complete your account setup, please click the link below:</p>
          <p style="margin: 20px 0;">
            <a href="{{setupUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Complete Account Setup
            </a>
          </p>
          <p>This link will expire in 7 days.</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          <p>Best regards,<br>The {{appName}} Team</p>
        </div>
      `,
      text: `
Welcome to {{appName}}!

Hello {{userName}},

You've been invited to join {{appName}} by {{invitedByName}}.

To complete your account setup, please visit: {{setupUrl}}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
The {{appName}} Team
      `
    })

    // Fallback password reset template
    this.templates.set('password-reset', {
      subject: 'Reset Your {{appName}} Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Password Reset Request</h1>
          <p>Hello {{userName}},</p>
          <p>You requested a password reset for your {{appName}} account.</p>
          <p>To reset your password, please click the link below:</p>
          <p style="margin: 20px 0;">
            <a href="{{resetUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Reset Password
            </a>
          </p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this password reset, you can safely ignore this email.</p>
          <p>Best regards,<br>The {{appName}} Team</p>
        </div>
      `,
      text: `
Password Reset Request

Hello {{userName}},

You requested a password reset for your {{appName}} account.

To reset your password, please visit: {{resetUrl}}

This link will expire in 24 hours.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
The {{appName}} Team
      `
    })
  }

  private compileTemplate(template: string, data: Record<string, any>): string {
    const compiled = handlebars.compile(template)
    return compiled(data)
  }

  async sendInvitationEmail(
    userEmail: string,
    userName: string,
    invitedByName: string,
    invitationToken: string
  ): Promise<boolean> {
    try {
      const config = await this.getEmailConfig()
      if (!config) {
        console.log('Email service not configured, skipping invitation email')
        return false
      }

      const template = this.templates.get('invitation')
      
      if (!template) {
        throw new Error('Invitation email template not found')
      }

      const appName = config.from.name || 'Agent AI Server'
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const setupUrl = `${baseUrl}/setup-account?token=${invitationToken}`

      const templateData = {
        userName,
        invitedByName,
        appName,
        setupUrl
      }

      const mailOptions = {
        from: `${config.from.name} <${config.from.email}>`,
        to: userEmail,
        subject: this.compileTemplate(template.subject, templateData),
        html: this.compileTemplate(template.html, templateData),
        text: this.compileTemplate(template.text, templateData)
      }

      const transporter = await this.createTransport(config)
      await transporter.sendMail(mailOptions)

              console.log('Invitation email sent successfully')
      return true

    } catch (error) {
      console.error('Failed to send invitation email:', error)
      return false
    }
  }

  async sendPasswordResetEmail(
    userEmail: string,
    userName: string,
    resetToken: string
  ): Promise<boolean> {
    try {
      const config = await this.getEmailConfig()
      if (!config) {
        console.log('Email service not configured, skipping password reset email')
        return false
      }

      const transporter = await this.createTransport(config)
      const template = this.templates.get('password-reset')
      
      if (!template) {
        throw new Error('Password reset email template not found')
      }

      const appName = config.from.name || 'Agent AI Server'
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

      const templateData = {
        userName,
        appName,
        resetUrl
      }

      const mailOptions = {
        from: `${config.from.name} <${config.from.email}>`,
        to: userEmail,
        subject: this.compileTemplate(template.subject, templateData),
        html: this.compileTemplate(template.html, templateData),
        text: this.compileTemplate(template.text, templateData)
      }

      await transporter.sendMail(mailOptions)
              console.log('Password reset email sent successfully')
      return true

    } catch (error) {
      console.error('Failed to send password reset email:', error)
      return false
    }
  }

  async sendWelcomeEmail(
    userEmail: string,
    userName: string
  ): Promise<boolean> {
    try {
      const config = await this.getEmailConfig()
      if (!config) {
        console.log('Email service not configured, skipping welcome email')
        return false
      }

      const transporter = await this.createTransport(config)
      const template = this.templates.get('welcome')
      
      if (!template) {
        throw new Error('Welcome email template not found')
      }

      const appName = config.from.name || 'Agent AI Server'
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

      const templateData = {
        userName,
        appName,
        dashboardUrl: `${baseUrl}/agents`
      }

      const mailOptions = {
        from: `${config.from.name} <${config.from.email}>`,
        to: userEmail,
        subject: this.compileTemplate(template.subject, templateData),
        html: this.compileTemplate(template.html, templateData),
        text: this.compileTemplate(template.text, templateData)
      }

      await transporter.sendMail(mailOptions)
              console.log('Welcome email sent successfully')
      return true

    } catch (error) {
      console.error('Failed to send welcome email:', error)
      return false
    }
  }

  async testEmailConfiguration(testEmail?: string): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getEmailConfig()
      if (!config) {
        return { success: false, message: 'Email service is not configured or disabled' }
      }

      const transporter = await this.createTransport(config)
      
      // Verify the connection
      await transporter.verify()
      
      // If test email is provided, send a test email
      if (testEmail) {
        const appName = config.from.name || 'Agent AI Server'
        const testTime = new Date().toLocaleString()
        
        const mailOptions = {
          from: `${config.from.name} <${config.from.email}>`,
          to: testEmail,
          subject: `Test Email from ${appName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">Email Configuration Test</h1>
              <p>Hello!</p>
              <p>This is a test email to verify that your email configuration is working correctly.</p>
              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #374151;">Configuration Details:</h3>
                <p style="margin: 5px 0;"><strong>Provider:</strong> SMTP</p>
                <p style="margin: 5px 0;"><strong>Host:</strong> ${config.smtp.host}:${config.smtp.port}</p>
                <p style="margin: 5px 0;"><strong>From:</strong> ${config.from.name} &lt;${config.from.email}&gt;</p>
                <p style="margin: 5px 0;"><strong>Test Time:</strong> ${testTime}</p>
              </div>
              <p>If you received this email, your email configuration is working properly!</p>
              <p>Best regards,<br>The ${appName} Team</p>
            </div>
          `,
          text: `
Email Configuration Test

Hello!

This is a test email to verify that your email configuration is working correctly.

Configuration Details:
- Provider: SMTP
- Host: ${config.smtp.host}:${config.smtp.port}
- From: ${config.from.name} <${config.from.email}>
- Test Time: ${testTime}

If you received this email, your email configuration is working properly!

Best regards,
The ${appName} Team
          `
        }

        await transporter.sendMail(mailOptions)
        return { success: true, message: `Test email sent successfully to ${testEmail}` }
      }
      
      return { success: true, message: 'Email configuration is valid and working' }
    } catch (error: any) {
      return { success: false, message: `Email configuration error: ${error.message}` }
    }
  }
}

export default new EmailService() 