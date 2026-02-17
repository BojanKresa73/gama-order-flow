// Beautiful newsletter-style email template for delivery notes

export interface EmailTemplateData {
  clientName: string;
  orderNumber: string;
  orderDate: string;
  closedDate: string;
  itemCount: number;
  orderType: string;
  items: Array<{
    filename: string;
    details?: string;
    quantity: string | number;
  }>;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyPib?: string;
}

export function generateDeliveryNoteEmailHtml(data: EmailTemplateData): string {
  const {
    clientName,
    orderNumber,
    orderDate,
    closedDate,
    itemCount,
    orderType,
    items,
    companyName = 'GAMA UNITED d.o.o.',
    companyAddress = 'Veljka Milićevića 2/10, 11000 Beograd',
    companyPhone = '+381 11 316 16 29',
    companyEmail = 'ctp@gamaunited.rs',
    companyPib = '114876455',
  } = data;

  const orderTypeLabel = {
    ctp: 'CTP ploče',
    digital: 'Digitalna štampa',
    film: 'Filmovanje',
    razno: 'Ostalo',
  }[orderType.toLowerCase()] || orderType;

  // Generate items table rows (max 10 items in email, rest will be in PDF)
  const displayItems = items.slice(0, 10);
  const hasMoreItems = items.length > 10;

  const itemsTableRows = displayItems.map((item, idx) => `
    <tr>
      <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; color: #718096; font-size: 14px; text-align: center; width: 50px;">
        ${idx + 1}
      </td>
      <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; color: #1a365d; font-size: 14px; font-weight: 500;">
        ${item.filename.length > 45 ? item.filename.substring(0, 42) + '...' : item.filename}
      </td>
      <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; color: #718096; font-size: 14px; text-align: center;">
        ${item.details || '-'}
      </td>
      <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; color: #1a365d; font-size: 14px; font-weight: 600; text-align: center;">
        ${item.quantity}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Otpremnica - ${orderNumber}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1); overflow: hidden; max-width: 640px;">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 50%, #2b6cb0 100%); padding: 48px 48px 40px 48px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px;">
                      GAMA UNITED
                    </h1>
                    <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 13px; letter-spacing: 3px; text-transform: uppercase; font-weight: 500;">
                      Grafička industrija
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background: rgba(255, 255, 255, 0.15); border-radius: 30px; padding: 10px 20px;">
                          <span style="color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Otpremnica</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px; text-align: right;">
                          <span style="color: rgba(255, 255, 255, 0.9); font-size: 18px; font-weight: 700;">${orderNumber}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Curved separator -->
          <tr>
            <td style="height: 20px; background: linear-gradient(135deg, #1a365d 0%, #2c5282 50%, #2b6cb0 100%);">
              <div style="height: 20px; background: #ffffff; border-radius: 20px 20px 0 0;"></div>
            </td>
          </tr>
          
          <!-- Greeting Section -->
          <tr>
            <td style="padding: 16px 48px 32px 48px;">
              <h2 style="margin: 0 0 12px 0; color: #1a365d; font-size: 24px; font-weight: 700;">
                Poštovani ${clientName},
              </h2>
              <p style="margin: 0; color: #4a5568; font-size: 16px; line-height: 1.7;">
                Vaša porudžbina je uspešno završena i spremna za preuzimanje. U prilogu se nalazi PDF otpremnica sa svim detaljima.
              </p>
            </td>
          </tr>
          
          <!-- Order Details Cards -->
          <tr>
            <td style="padding: 0 48px 32px 48px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Order Type Card -->
                  <td width="48%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #ebf4ff 0%, #e6f0ff 100%); border-radius: 16px; border: 1px solid #c3dafe;">
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-right: 14px; vertical-align: top;">
                                <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #3182ce 0%, #4299e1 100%); border-radius: 12px; text-align: center; line-height: 44px;">
                                  <span style="color: #ffffff; font-size: 18px; font-weight: 800;">TIP</span>
                                </div>
                              </td>
                              <td style="vertical-align: top;">
                                <p style="margin: 0; color: #4a5568; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Tip naloga</p>
                                <p style="margin: 4px 0 0 0; color: #1a365d; font-size: 17px; font-weight: 700;">${orderTypeLabel}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Items Count Card -->
                  <td width="48%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%); border-radius: 16px; border: 1px solid #9ae6b4;">
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-right: 14px; vertical-align: top;">
                                <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #38a169 0%, #48bb78 100%); border-radius: 12px; text-align: center; line-height: 44px;">
                                  <span style="color: #ffffff; font-size: 18px; font-weight: 800;">#</span>
                                </div>
                              </td>
                              <td style="vertical-align: top;">
                                <p style="margin: 0; color: #4a5568; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Broj stavki</p>
                                <p style="margin: 4px 0 0 0; color: #1a365d; font-size: 17px; font-weight: 700;">${itemCount}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Date Cards Row -->
          <tr>
            <td style="padding: 0 48px 32px 48px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Created Date Card -->
                  <td width="48%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f7fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-right: 14px; vertical-align: top;">
                                <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #805ad5 0%, #9f7aea 100%); border-radius: 12px; text-align: center; line-height: 44px;">
                                  <span style="color: #ffffff; font-size: 18px; font-weight: 800;">&#9650;</span>
                                </div>
                              </td>
                              <td style="vertical-align: top;">
                                <p style="margin: 0; color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Kreiran</p>
                                <p style="margin: 4px 0 0 0; color: #1a365d; font-size: 15px; font-weight: 600;">${orderDate}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Closed Date Card -->
                  <td width="48%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f7fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-right: 14px; vertical-align: top;">
                                <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #dd6b20 0%, #ed8936 100%); border-radius: 12px; text-align: center; line-height: 44px;">
                                  <span style="color: #ffffff; font-size: 18px; font-weight: 800;">&#10003;</span>
                                </div>
                              </td>
                              <td style="vertical-align: top;">
                                <p style="margin: 0; color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Zatvoren</p>
                                <p style="margin: 4px 0 0 0; color: #1a365d; font-size: 15px; font-weight: 600;">${closedDate}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Items Table -->
          <tr>
            <td style="padding: 0 48px 32px 48px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 16px 20px;">
                    <span style="color: #ffffff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Pregled stavki</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <!-- Table Header -->
                      <tr style="background: #f7fafc;">
                        <td style="padding: 12px 12px; border-bottom: 2px solid #e2e8f0; color: #718096; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center; width: 50px;">
                          #
                        </td>
                        <td style="padding: 12px 12px; border-bottom: 2px solid #e2e8f0; color: #718096; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                          Naziv
                        </td>
                        <td style="padding: 12px 12px; border-bottom: 2px solid #e2e8f0; color: #718096; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center;">
                          Detalji
                        </td>
                        <td style="padding: 12px 12px; border-bottom: 2px solid #e2e8f0; color: #718096; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center;">
                          Količina
                        </td>
                      </tr>
                      <!-- Table Body -->
                      ${itemsTableRows}
                      ${hasMoreItems ? `
                      <tr>
                        <td colspan="4" style="padding: 16px; background: #f7fafc; text-align: center; color: #718096; font-size: 13px; font-style: italic;">
                          ... i još ${items.length - 10} stavki (vidljivo u PDF prilogu)
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- PDF Attachment Notice -->
          <tr>
            <td style="padding: 0 48px 32px 48px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #ebf8ff 0%, #e6f7ff 100%); border-radius: 16px; border: 2px dashed #63b3ed;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-right: 18px; vertical-align: top;">
                          <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #3182ce 0%, #4299e1 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);">
                            <span style="color: #ffffff; font-size: 22px; font-weight: 800;">PDF</span>
                          </div>
                        </td>
                        <td style="vertical-align: top;">
                          <p style="margin: 0 0 6px 0; color: #2c5282; font-size: 18px; font-weight: 700;">
                            PDF Otpremnica u prilogu
                          </p>
                          <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                            Kompletna otpremnica sa svim detaljima je priložena u PDF formatu. Sačuvajte je za vašu evidenciju.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 48px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #e2e8f0 15%, #e2e8f0 85%, transparent 100%);"></div>
            </td>
          </tr>
          
          <!-- Contact Section -->
          <tr>
            <td style="padding: 32px 48px 40px 48px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      Kontakt
                    </p>
                    <p style="margin: 0 0 16px 0; color: #1a365d; font-size: 18px; font-weight: 700;">
                      ${companyName}
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #4a5568; font-size: 14px;">&#9679; ${companyAddress}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #4a5568; font-size: 14px;">Tel: ${companyPhone}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #4a5568; font-size: 14px;">Email: ${companyEmail}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #4a5568; font-size: 14px;">PIB: ${companyPib}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 24px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">
                Hvala vam na poverenju!
              </p>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.6); font-size: 12px;">
                © ${new Date().getFullYear()} ${companyName}. Sva prava zadržana.
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Email footer note -->
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width: 640px;">
          <tr>
            <td style="padding: 24px 48px; text-align: center;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; line-height: 1.6;">
                Ovu poruku ste dobili jer ste prijavljeni za obaveštenja o narudžbinama.<br>
                Za sva pitanja kontaktirajte nas na ${companyEmail}
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
