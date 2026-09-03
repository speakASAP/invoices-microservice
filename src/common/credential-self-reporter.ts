import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoggerService } from './logger.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const reporter = require('./vendor/credential-reporter.js');

const SELF_REPORT_CRON = process.env.CREDENTIAL_SELF_REPORT_CRON || '*/30 * * * *';

const ORDERS_URL =
  process.env.ORDERS_SERVICE_URL ||
  'http://orders-microservice.statex-apps.svc.cluster.local:3210';

const MONITORING_URL =
  process.env.MONITORING_URL ||
  'http://monitoring-microservice.statex-apps.svc.cluster.local:3395';

/** This service's orders principal, exactly as auth lists it. */
const PRINCIPAL = 'svc-invoices-microservice--orders-microservice@internal.alfares.cz';

const TARGET = 'orders-microservice';

/**
 * Reports this service's orders credential, per
 * `monitoring-microservice/docs/CREDENTIAL_SELF_REPORT_CONTRACT.md`.
 *
 * **Probe target, and its known limitation.** This credential holds
 * `internal:invoices-microservice:service`, which orders enforces on
 * `ORDER_DETAIL_READ_ROLES` — `GET /api/orders/:id`. That route was rejected as
 * the probe because `ParseUUIDPipe` plus a nonexistent id returns 404, which the
 * contract classifies `indeterminate`, and probing a *real* order id would tie a
 * credential check to specific data surviving in the database.
 *
 * `GET /api/orders/customer/lifecycle` is used instead. Verified live: 200 with
 * the real token, 401 with a garbage token, 401 with no credential at all.
 *
 * Its limitation is worth stating plainly: `ORDER_CUSTOMER_LIFECYCLE_READ_ROLES`
 * includes `'authenticated:user'`, so the route accepts any valid principal
 * rather than this role specifically. It therefore proves the credential is
 * *valid* — catching expiry, revocation, wrong algorithm and the empty-token
 * case — but would not catch this principal losing only its
 * `invoices-microservice:service` grant while staying otherwise valid. That is a
 * weaker check than `svc-catalog--warehouse` gets, and much stronger than
 * `/health`, which answers 200 with no credential at all and so can never fail.
 */
@Injectable()
export class CredentialSelfReporter {
  constructor(private readonly logger: LoggerService) {}

  @Cron(SELF_REPORT_CRON)
  async scheduledReport(): Promise<void> {
    if (process.env.CREDENTIAL_SELF_REPORT_ENABLED === 'false') return;
    await this.runReport();
  }

  async runReport(): Promise<{ verdict: string; posted: boolean } | null> {
    const token = (process.env.ORDERS_SERVICE_TOKEN || '').trim();
    const ingestToken = (process.env.NOTIFICATION_SERVICE_TOKEN || '').trim();

    if (!ingestToken) {
      // A reporter that stops reporting is indistinguishable from a credential
      // that broke, and silence is this design's primary signal.
      this.logger.error(
        'credential_self_report_undeliverable',
        undefined,
        'CredentialSelfReporter',
        { principal: PRINCIPAL, reason: 'NOTIFICATION_SERVICE_TOKEN is empty' },
      );
      return null;
    }

    const outcome = await reporter.reportCredential({
      url: `${ORDERS_URL}/api/orders/customer/lifecycle`,
      token,
      serviceName: 'invoices-microservice',
      monitoringUrl: MONITORING_URL,
      ingestToken,
      principal: PRINCIPAL,
      target: TARGET,
    });

    this.logger.log('credential_self_report_sent', 'CredentialSelfReporter', {
      principal: PRINCIPAL,
      target: TARGET,
      verdict: outcome.verdict,
      posted: outcome.posted,
      error: outcome.error ?? null,
    });

    if (!outcome.posted) {
      this.logger.warn(
        `probe said ${outcome.verdict} but the report was not accepted` +
          (outcome.error ? `: ${outcome.error}` : ''),
        'CredentialSelfReporter',
        { principal: PRINCIPAL },
      );
    }

    return { verdict: outcome.verdict, posted: outcome.posted };
  }
}
