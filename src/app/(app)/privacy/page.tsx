import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-6 pt-12 pb-16 max-w-lg mx-auto">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-8"
        style={{ color: '#E8622A' }}
      >
        ← Retour
      </Link>

      <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#1D3550' }}>
        Politique de Confidentialité
      </h1>
      <p className="text-sm text-gray-400 mb-8">BDE ECM Dijon — Dernière mise à jour : avril 2026</p>

      <div className="flex flex-col gap-8" style={{ color: '#1D3550' }}>

        <section>
          <h2 className="text-base font-bold mb-2">1. Données collectées</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Dans le cadre de l'utilisation de l'application BDE ECM Dijon, nous collectons les informations suivantes :
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {['Adresse email', 'Nom et prénom', 'École / établissement', 'Points de fidélité'].map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#E8622A' }} />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2">2. Stockage des données</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Tes données sont stockées de manière sécurisée sur les serveurs de <strong>Supabase</strong>,
            un service conforme aux standards de sécurité modernes (chiffrement en transit et au repos).
            Elles ne sont accessibles qu'aux membres du bureau du BDE ECM Dijon.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2">3. Utilisation des données</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Tes données sont utilisées uniquement pour le fonctionnement de l'application :
            gestion du compte, suivi des points de fidélité, et communication relative aux événements du BDE.
            <strong> Aucune donnée n'est vendue ni partagée avec des tiers.</strong>
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2">4. Notifications push</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            L'application peut envoyer des notifications push via <strong>OneSignal</strong>.
            Ces notifications sont entièrement optionnelles. Tu peux les activer ou les désactiver
            à tout moment depuis les réglages de ton appareil.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2">5. Tes droits</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Conformément au RGPD, tu disposes d'un droit d'accès, de rectification et de suppression
            de tes données personnelles. Pour exercer ces droits, contacte-nous à l'adresse ci-dessous.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2">6. Contact</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Pour toute question relative à la confidentialité de tes données :
          </p>
          <a
            href="mailto:bde@ecm-dijon.fr"
            className="inline-block mt-2 text-sm font-semibold"
            style={{ color: '#E8622A' }}
          >
            bde@ecm-dijon.fr
          </a>
        </section>

      </div>
    </div>
  )
}
