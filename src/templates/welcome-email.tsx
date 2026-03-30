// Welcome Email Template - HiTGuest Brand
// Bilingual template (Spanish and English) with brand colors and logo

export interface WelcomeEmailTemplateProps {
  userName: string
  clientName: string
  loginUrl: string
  language: 'es' | 'en'
}

export const WelcomeEmailTemplate = ({ 
  userName, 
  clientName, 
  loginUrl, 
  language = 'es' 
}: WelcomeEmailTemplateProps) => {
  const content = {
    es: {
      greeting: `¡Hola, ${userName}!`,
      title: 'Nos emociona darte la bienvenida a HiTGuest',
      subtitle: `Tu cuenta para **${clientName}** ha sido creada exitosamente. A partir de este momento, tienes todo listo para empezar a gestionar y centralizar tus propiedades e integraciones.`,
      buttonText: 'Ingresar a mi cuenta',
      nextStepsTitle: '¿Qué sigue?',
      nextStepsText: 'Te recomendamos comenzar configurando tus primeras conexiones con tus canales y PMS en la sección de integraciones.',
      supportText: 'Si tienes alguna pregunta durante tu configuración, nuestro equipo de soporte está siempre disponible para ayudarte.',
      closing: '¡Mucho éxito en tu gestión!',
      signature: 'Saludos,<br>El equipo de HiTGuest',
    },
    en: {
      greeting: `Hello, ${userName}!`,
      title: 'We\'re excited to welcome you to HiTGuest',
      subtitle: `Your account for **${clientName}** has been successfully created. From this moment on, you have everything ready to start managing and centralizing your properties and integrations.`,
      buttonText: 'Access my account',
      nextStepsTitle: 'What\'s next?',
      nextStepsText: 'We recommend starting by configuring your first connections with your channels and PMS in the integrations section.',
      supportText: 'If you have any questions during your setup, our support team is always available to help you.',
      closing: 'Much success in your management!',
      signature: 'Best regards,<br>The HiTGuest Team',
    },
  }

  const t = content[language]

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to HiTGuest</title>
    <style>
        /* Brand Colors */
        :root {
            --brand-primary: #5c6fb1;
            --brand-secondary: #9333ea;
            --brand-accent: #7c8bc1;
            --brand-dark: #1e293b;
            --brand-light: #f8fafc;
            --brand-grey: #64748b;
            --brand-border: #e2e8f0;
            --brand-success: #22c55e;
            --brand-error: #ef4444;
        }
        
        /* Base Styles */
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f7fa;
            color: var(--brand-dark);
            line-height: 1.6;
        }
        
        /* Container */
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: var(--brand-light);
        }
        
        /* Header */
        .email-header {
            background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            border-radius: 12px 12px 0 0;
            position: relative;
            overflow: hidden;
        }
        
        .email-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
            background-size: 30px 30px;
            opacity: 0.3;
        }
        
        .logo {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
        }
        
        .logo .hit {
            color: white;
            letter-spacing: -1px;
        }
        
        .logo .dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            background-color: var(--brand-secondary);
            border-radius: 2px;
            margin: 0 2px;
            vertical-align: middle;
        }
        
        .logo .guest {
            color: white;
            font-weight: 600;
        }
        
        /* Main Content */
        .email-body {
            background-color: white;
            padding: 40px 30px;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        
        .greeting {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 20px;
            color: var(--brand-primary);
        }
        
        .title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--brand-dark);
        }
        
        .subtitle {
            font-size: 16px;
            color: var(--brand-grey);
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .subtitle strong {
            color: var(--brand-primary);
            font-weight: 600;
        }
        
        /* Button */
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        
        .button {
            display: inline-block;
            background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(92, 111, 177, 0.3);
            transition: all 0.3s ease;
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(92, 111, 177, 0.4);
        }
        
        /* Next Steps */
        .next-steps {
            background-color: var(--brand-light);
            border-left: 4px solid var(--brand-primary);
            padding: 20px;
            margin: 30px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .next-steps-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--brand-primary);
            margin-bottom: 10px;
        }
        
        .next-steps-text {
            font-size: 15px;
            color: var(--brand-grey);
            line-height: 1.6;
        }
        
        /* Support */
        .support {
            background-color: #f0f9ff;
            border-left: 4px solid var(--brand-secondary);
            padding: 20px;
            margin: 30px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .support-text {
            font-size: 15px;
            color: var(--brand-grey);
            line-height: 1.6;
        }
        
        /* Footer */
        .email-footer {
            text-align: center;
            padding: 30px 20px;
            color: var(--brand-grey);
            font-size: 14px;
        }
        
        .closing {
            font-weight: 600;
            color: var(--brand-primary);
            margin-bottom: 15px;
        }
        
        .signature {
            font-size: 14px;
            color: var(--brand-grey);
        }
        
        .signature strong {
            color: var(--brand-primary);
        }
        
        /* Responsive */
        @media (max-width: 600px) {
            .email-container {
                padding: 10px;
            }
            
            .email-header, .email-body {
                padding: 30px 20px;
            }
            
            .logo {
                font-size: 28px;
            }
            
            .greeting {
                font-size: 22px;
            }
            
            .title {
                font-size: 18px;
            }
            
            .button {
                padding: 14px 28px;
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="email-header">
            <div class="logo">
                <span class="hit">HiT</span><span class="dot"></span><span class="guest">Guest</span>
            </div>
        </div>
        
        <!-- Main Content -->
        <div class="email-body">
            <h1 class="greeting">${t.greeting}</h1>
            
            <h2 class="title">${t.title}</h2>
            
            <p class="subtitle">${t.subtitle}</p>
            
            <!-- CTA Button -->
            <div class="button-container">
                <a href="${loginUrl}" class="button">
                    ${t.buttonText}
                </a>
            </div>
            
            <!-- Next Steps -->
            <div class="next-steps">
                <h3 class="next-steps-title">${t.nextStepsTitle}</h3>
                <p class="next-steps-text">${t.nextStepsText}</p>
            </div>
            
            <!-- Support -->
            <div class="support">
                <p class="support-text">${t.supportText}</p>
            </div>
            
            <!-- Closing -->
            <div class="closing">
                ${t.closing}
            </div>
            
            <div class="signature">
                ${t.signature}
            </div>
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
            <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">
                Powered by <strong style="color: var(--brand-primary);">HIT Guest</strong> © 2024
            </p>
        </div>
    </div>
</body>
</html>
  `.trim()
}

// Helper function to generate HTML email
export const generateWelcomeEmail = (props: WelcomeEmailTemplateProps): string => {
  return WelcomeEmailTemplate(props)
}

// Example usage:
// const spanishEmail = generateWelcomeEmail({
//   userName: 'Juan Rodríguez',
//   clientName: 'Hotel Paradise',
//   loginUrl: 'https://hitguest.com/login',
//   language: 'es'
// })
//
// const englishEmail = generateWelcomeEmail({
//   userName: 'John Smith',
//   clientName: 'Paradise Hotel',
//   loginUrl: 'https://hitguest.com/login',
//   language: 'en'
// })
