import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Taille de haie ACF'

interface EstimationProps {
  clientName?: string
  totalPrice?: string | number
  message?: string
}

const EstimationEmail = ({ clientName, totalPrice, message }: EstimationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre estimation de {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {clientName ? `Bonjour ${clientName},` : 'Bonjour,'}
        </Heading>
        <Text style={text}>
          {message ?? `Veuillez trouver ci-joint notre estimation pour les travaux de coupe de haies.`}
        </Text>
        {totalPrice !== undefined && (
          <Text style={total}>Total estimé : {totalPrice} $</Text>
        )}
        <Text style={text}>
          N'hésitez pas à nous contacter pour toute question.
        </Text>
        <Text style={footer}>Cordialement,<br />L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EstimationEmail,
  subject: 'Votre estimation - Taille de haie ACF',
  displayName: 'Estimation au client',
  previewData: { clientName: 'Jean Tremblay', totalPrice: '450.00' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const total = { fontSize: '16px', fontWeight: 'bold', color: '#15803d', margin: '0 0 16px' }
const footer = { fontSize: '12px', color: '#64748b', margin: '24px 0 0' }
