import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Taille de haie ACF'

interface InvoiceProps {
  clientName?: string
  amount?: string | number
  invoiceNumber?: string
  message?: string
}

const InvoiceEmail = ({ clientName, amount, invoiceNumber, message }: InvoiceProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre facture de {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {clientName ? `Bonjour ${clientName},` : 'Bonjour,'}
        </Heading>
        <Text style={text}>
          {message ?? `Veuillez trouver ci-joint votre facture${invoiceNumber ? ` ${invoiceNumber}` : ''}.`}
        </Text>
        {amount !== undefined && (
          <Text style={total}>Montant : {amount} $</Text>
        )}
        <Text style={text}>Merci de votre confiance.</Text>
        <Text style={footer}>Cordialement,<br />L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvoiceEmail,
  subject: (data) => `Facture${data?.invoiceNumber ? ` ${data.invoiceNumber}` : ''} - Taille de haie ACF`,
  displayName: 'Facture au client',
  previewData: { clientName: 'Jean Tremblay', amount: '450.00', invoiceNumber: 'F-2026-001' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const total = { fontSize: '16px', fontWeight: 'bold', color: '#15803d', margin: '0 0 16px' }
const footer = { fontSize: '12px', color: '#64748b', margin: '24px 0 0' }
