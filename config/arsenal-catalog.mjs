/*
 * arsenal-catalog.mjs — SOURCE OF TRUTH for the JAQA Arsenal: a curated,
 * clean-room registry of open-source security, supply-chain and medical/health
 * repositories. Transcribed from the product owner's provided catalogue.
 *
 * This file is DATA ONLY (no code is copied from any listed project). The
 * Arsenal links out to each repository; it does not run, embed or bundle them.
 * `scripts/build-arsenal.mjs` validates this (every entry must be `owner/repo`),
 * de-duplicates repos that appear in several categories, and writes
 * config/arsenal.json, which the build embeds for the Arsenal modules.
 *
 * Entry shape: [ 'owner/repo', 'short description' ]
 * JAQA™ is a trademark of JAQA. © JAQA™. Licensed under AGPL-3.0-or-later.
 */

// Each domain → ordered categories → entries. Category ids are stable slugs.
export const DOMAINS = [
  {
    id: 'security',
    label: 'Security',
    blurb: 'Open-source tooling across the full security lifecycle: knowledge bases, detection, threat intel, DFIR, offensive testing, cloud, crypto, OSINT and GRC.',
    categories: [
      {
        id: 'knowledge-bases',
        label: 'Knowledge bases & learning targets',
        entries: [
          ['trimstray/the-book-of-secret-knowledge', 'Large security/sysadmin knowledge base.'],
          ['onlurking/awesome-infosec', 'Classic information-security awesome list.'],
          ['enaqx/awesome-pentest', 'Penetration-testing resources.'],
          ['jivoi/awesome-osint', 'OSINT tools and resources.'],
          ['lockfale/OSINT-Framework', 'OSINT methodology/framework.'],
          ['HackTricks-wiki/hacktricks', 'Practical security/CTF/pentest wiki.'],
          ['swisskyrepo/PayloadsAllTheThings', 'Payload/reference cheat-sheet collection.'],
          ['danielmiessler/SecLists', 'Essential wordlists for security testing.'],
          ['berzerk0/Probable-Wordlists', 'Password/wordlist resources.'],
          ['OWASP/owasp-mstg', 'OWASP Mobile Security Testing Guide.'],
          ['OWASP/IoTGoat', 'Intentionally vulnerable IoT target.'],
          ['WebGoat/WebGoat', 'OWASP-style vulnerable web app.'],
          ['bkimminich/juice-shop', 'OWASP Juice Shop, modern vulnerable web app.'],
          ['digininja/DVWA', 'Damn Vulnerable Web App.'],
          ['CTFd/CTFd', 'CTF platform.'],
          ['shellphish/how2heap', 'Heap-exploitation learning repo.']
        ]
      },
      {
        id: 'detection-standards',
        label: 'Threat modeling, ATT&CK, detection & standards',
        entries: [
          ['mitre/attack-navigator', 'MITRE ATT&CK Navigator.'],
          ['mitre/cti', 'MITRE ATT&CK/CAR/D3FEND in STIX/TAXII.'],
          ['mitre/caldera', 'Automated adversary emulation / purple team.'],
          ['redcanaryco/atomic-red-team', 'Atomic threat tests mapped to ATT&CK.'],
          ['SigmaHQ/sigma', 'Generic SIEM detection-rule format.'],
          ['VirusTotal/yara', 'YARA malware/pattern-matching engine.'],
          ['Yara-Rules/rules', 'Community YARA rules.'],
          ['Neo23x0/signature-base', 'Threat-hunting YARA/Sigma rules.'],
          ['Neo23x0/Loki', 'Simple IOC/log scanner.'],
          ['mitre-attack/car', 'MITRE Cyber Analytics Repository.'],
          ['oasis-open/cti-stix2-json-schemas', 'STIX 2 JSON schemas.'],
          ['usnistgov/OSCAL', 'NIST OSCAL machine-readable controls/catalogs.'],
          ['ComplianceAsCode/content', 'Automated compliance content (SCAP/OSCAL).']
        ]
      },
      {
        id: 'threat-intel',
        label: 'Threat intelligence platforms & case management',
        entries: [
          ['MISP/MISP', 'Open-source threat-intelligence platform.'],
          ['MISP/PyMISP', 'Python library for MISP.'],
          ['OpenCTI-Platform/opencti', 'Open cyber-threat-intelligence platform.'],
          ['TheHive-Project/TheHive', 'Incident-response / case management.'],
          ['TheHive-Project/Cortex', 'Analytical engine for TheHive.'],
          ['yeti-platform/yeti', 'Threat-intelligence repository.'],
          ['telekom-security/maltrail', 'Malicious-traffic detection system.']
        ]
      },
      {
        id: 'siem-edr',
        label: 'SIEM, EDR, telemetry & endpoint visibility',
        entries: [
          ['wazuh/wazuh', 'Open-source XDR/SIEM/HIDS.'],
          ['Security-Onion-Solutions/securityonion', 'Network security monitoring platform.'],
          ['Velocidex/velociraptor', 'Endpoint visibility / DFIR.'],
          ['google/grr', 'Google Rapid Response forensic framework.'],
          ['osquery/osquery', 'SQL-based endpoint telemetry.'],
          ['fleetdm/fleet', 'osquery manager / device telemetry.'],
          ['falcosecurity/falco', 'Cloud-native runtime security.'],
          ['zeek/zeek', 'Network security monitor.'],
          ['OISF/suricata', 'IDS/IPS.'],
          ['snort3/snort3', 'Classic IDS/IPS.'],
          ['wireshark/wireshark', 'Packet analysis.'],
          ['secdev/scapy', 'Packet manipulation/analysis.'],
          ['elastic/detection-rules', 'Elastic security detection rules.'],
          ['vectordotdev/vector', 'High-performance log/metrics pipeline.'],
          ['fluent/fluent-bit', 'Lightweight log forwarder.'],
          ['open-telemetry/opentelemetry-collector', 'OpenTelemetry collector.'],
          ['grafana/loki', 'Log-aggregation system.'],
          ['elastic/elasticsearch', 'Search/analytics engine used in SIEM stacks.'],
          ['opensearch-project/OpenSearch', 'Elasticsearch fork.'],
          ['Graylog2/graylog2-server', 'Log management.']
        ]
      },
      {
        id: 'dfir-re',
        label: 'DFIR, malware analysis & reverse engineering',
        entries: [
          ['volatilityfoundation/volatility3', 'Memory-forensics framework.'],
          ['log2timeline/plaso', 'Super-timeline / artifact parsing.'],
          ['sleuthkit/sleuthkit', 'Disk-forensics toolkit.'],
          ['sleuthkit/autopsy', 'GUI for Sleuth Kit.'],
          ['google/timesketch', 'Collaborative forensic timeline analysis.'],
          ['Yamato-Security/hayabusa', 'Fast Windows EVTX analyzer.'],
          ['mandiant/capa', 'Malware capability extractor.'],
          ['mandiant/flare-floss', 'Obfuscated-string decoder for malware.'],
          ['NationalSecurityAgency/ghidra', 'NSA reverse-engineering suite.'],
          ['radareorg/radare2', 'Reverse-engineering framework.'],
          ['rizinorg/cutter', 'Reverse-engineering GUI.'],
          ['angr/angr', 'Binary-analysis platform.'],
          ['JonathanSalwan/Triton', 'Dynamic symbolic execution / taint.'],
          ['qilingframework/qiling', 'Binary-emulation framework.'],
          ['unicorn-engine/unicorn', 'CPU-emulator framework.'],
          ['keystone-engine/keystone', 'Assembler framework.'],
          ['Gallopsled/pwntools', 'Exploit-development / CTF framework.'],
          ['x64dbg/x64dbg', 'Windows debugger.'],
          ['dnSpyEx/dnSpy', '.NET debugger/assembler.'],
          ['icsharpcode/ILSpy', '.NET decompiler.'],
          ['hasherezade/pe-bear', 'PE parser/analysis.'],
          ['horsicq/Detect-It-Easy', 'Packer/compiler detector.'],
          ['kevoreilly/CAPEv2', 'Malware config-extraction sandbox.'],
          ['REMnux/remnux-distro', 'Malware-analysis Linux distro.'],
          ['frida/frida', 'Dynamic-instrumentation toolkit.'],
          ['sensepost/objection', 'Frida-based mobile exploration.'],
          ['iBotPeaches/Apktool', 'Android APK reverse engineering.'],
          ['skylot/jadx', 'Dex-to-Java decompiler.'],
          ['androguard/androguard', 'Android malware analysis.'],
          ['MobSF/Mobile-Security-Framework-MobSF', 'Mobile security testing framework.'],
          ['linkedin/qark', 'Android static analysis.'],
          ['WithSecureLabs/drozer', 'Android security-testing framework.'],
          ['JesusFreke/smali', 'Smali assembler/disassembler.'],
          ['nabla-c0d3/ssl-kill-switch2', 'iOS SSL-pinning testing helper.'],
          ['AloneMonkey/frida-ios-dump', 'iOS app dumping via Frida.']
        ]
      },
      {
        id: 'firmware-hw',
        label: 'Firmware, embedded, hardware, IoT & OT/ICS',
        entries: [
          ['ReFirmLabs/binwalk', 'Firmware analysis.'],
          ['craigz28/firmwalker', 'Firmware security checker.'],
          ['e-m-b-a/emba', 'Embedded/firmware security analyzer.'],
          ['firmadyne/firmadyne', 'Firmware emulation/analysis.'],
          ['flashrom/flashrom', 'SPI/EEPROM flashing utility.'],
          ['probe-rs/probe-rs', 'Embedded debugging/probing.'],
          ['openocd-org/openocd', 'On-chip debugger and flashing tool.'],
          ['YosysHQ/yosys', 'FPGA/ASIC synthesis framework.'],
          ['u-boot/u-boot', 'Bootloader used in many embedded devices.'],
          ['coreboot/coreboot', 'Open-source firmware project.'],
          ['tianocore/edk2', 'UEFI firmware development environment.'],
          ['ARM-software/arm-trusted-firmware', 'ARM trusted firmware.'],
          ['tpm2-software/tpm2-tools', 'TPM 2.0 tools.'],
          ['tpm2-software/tpm2-tss', 'TPM 2.0 software stack.'],
          ['opendnssec/SoftHSMv2', 'Software HSM.'],
          ['p11-glue/p11-kit', 'PKCS#11 utility library.'],
          ['Yubico/yubihsm-shell', 'YubiHSM shell/tools.'],
          ['trustcrypto/OnlyKey-Firmware', 'OnlyKey hardware security-key firmware.'],
          ['Nitrokey/nitrokey-3-firmware', 'Nitrokey 3 firmware.'],
          ['keylime/keylime', 'TPM-based remote attestation.'],
          ['aircrack-ng/aircrack-ng', 'Wi-Fi security testing.'],
          ['bettercap/bettercap', 'Network attack/monitoring framework.'],
          ['greatscottgadgets/hackrf', 'SDR hardware/firmware.'],
          ['greatscottgadgets/ubertooth', 'Bluetooth analysis/testing.'],
          ['RfidResearchGroup/proxmark3', 'RFID/NFC research tool.'],
          ['nfc-tools/libnfc', 'NFC library.'],
          ['flipperdevices/flipperzero-firmware', 'Flipper Zero firmware.'],
          ['hardbyte/python-can', 'CAN-bus library.'],
          ['linux-can/can-utils', 'Linux CAN utilities.'],
          ['stepfunc/dnp3', 'DNP3 protocol implementation.'],
          ['open62541/open62541', 'OPC UA implementation.'],
          ['gijzelaerr/python-snap7', 'Siemens S7 communication library.']
        ]
      },
      {
        id: 'offensive-appsec',
        label: 'Vulnerability scanning, web/API & offensive testing',
        entries: [
          ['rapid7/metasploit-framework', 'Exploitation framework.'],
          ['nmap/nmap', 'Network scanner.'],
          ['robertdavidgraham/masscan', 'Fast Internet-scale port scanner.'],
          ['zmap/zmap', 'Network survey scanner.'],
          ['owasp-amass/amass', 'Attack-surface mapping.'],
          ['projectdiscovery/subfinder', 'Subdomain discovery.'],
          ['projectdiscovery/httpx', 'HTTP toolkit.'],
          ['projectdiscovery/nuclei', 'Template-based vulnerability scanner.'],
          ['projectdiscovery/nuclei-templates', 'Nuclei templates.'],
          ['projectdiscovery/naabu', 'Port scanner.'],
          ['projectdiscovery/interactsh', 'Out-of-band interaction server.'],
          ['zaproxy/zaproxy', 'OWASP ZAP web scanner.'],
          ['Arachni/arachni', 'Web-application scanner.'],
          ['sullo/nikto', 'Web-server scanner.'],
          ['maurosoria/dirsearch', 'Directory/file brute-forcer.'],
          ['OJ/gobuster', 'Directory/DNS/vhost brute-forcer.'],
          ['xmendez/wfuzz', 'Web fuzzer.'],
          ['ffuf/ffuf', 'Fast web fuzzer.'],
          ['sqlmapproject/sqlmap', 'SQL-injection testing tool.'],
          ['hahwul/dalfox', 'XSS scanning/testing.'],
          ['commixproject/commix', 'Command-injection testing.'],
          ['owasp-modsecurity/ModSecurity', 'Web application firewall.'],
          ['corazawaf/coraza', 'Go WAF.'],
          ['drwetter/testssl.sh', 'TLS/SSL testing.'],
          ['hashcat/hashcat', 'Password recovery/testing.'],
          ['openwall/john', 'John the Ripper password cracker.'],
          ['vanhauser-thc/thc-hydra', 'Network login tester.'],
          ['SpecterOps/BloodHound', 'Active Directory attack-path mapping.'],
          ['BloodHoundAD/SharpHound', 'BloodHound collector.']
        ]
      },
      {
        id: 'cloud-k8s',
        label: 'Cloud, IaC, Kubernetes & container security',
        entries: [
          ['prowler-cloud/prowler', 'Cloud security best-practices scanner.'],
          ['nccgroup/ScoutSuite', 'Multi-cloud security auditor.'],
          ['cloud-custodian/cloud-custodian', 'Cloud policy as code.'],
          ['turbot/steampipe', 'Query cloud APIs with SQL.'],
          ['salesforce/cloudsplaining', 'AWS IAM policy analysis.'],
          ['nccgroup/PMapper', 'AWS privilege-escalation mapping.'],
          ['DataDog/stratus-red-team', 'Cloud detection validation.'],
          ['gruntwork-io/cloud-nuke', 'Clean up cloud resources.'],
          ['aquasecurity/trivy', 'Container/IaC/code vulnerability scanner.'],
          ['bridgecrewio/checkov', 'IaC security scanner.'],
          ['aquasecurity/tfsec', 'Terraform security scanner.'],
          ['tenable/terrascan', 'IaC security scanner.'],
          ['terraform-compliance/cli', 'Terraform behaviour-driven compliance.'],
          ['kubescape/kubescape', 'Kubernetes security posture.'],
          ['aquasecurity/kube-bench', 'CIS Kubernetes benchmark checker.'],
          ['aquasecurity/kube-hunter', 'Kubernetes penetration testing.'],
          ['stackrox/kube-linter', 'Kubernetes linting.'],
          ['FairwindsOps/polaris', 'Kubernetes best-practices checker.'],
          ['doitintl/kube-no-trouble', 'Detect deprecated Kubernetes APIs.'],
          ['kyverno/kyverno', 'Kubernetes-native policy engine.'],
          ['open-policy-agent/gatekeeper', 'OPA Gatekeeper for Kubernetes.'],
          ['open-policy-agent/opa', 'Open Policy Agent.'],
          ['open-policy-agent/conftest', 'Test configs with Rego/OPA.'],
          ['aquasecurity/trivy-operator', 'Trivy in Kubernetes.'],
          ['goharbor/harbor', 'Cloud-native registry.'],
          ['quay/clair', 'Container vulnerability scanner.'],
          ['notaryproject/notary', 'Container trust/signing.'],
          ['notaryproject/ratify', 'Verify artifacts/signatures in Kubernetes.'],
          ['notaryproject/notation', 'Artifact signing/verification.'],
          ['sigstore/cosign', 'Container/artifact signing and verification.'],
          ['docker/docker-bench-security', 'Docker CIS benchmark checker.'],
          ['containers/podman', 'Daemonless container engine.'],
          ['moby/buildkit', 'Container build toolkit.'],
          ['containerd/containerd', 'Container runtime.'],
          ['cri-o/cri-o', 'Kubernetes CRI runtime.'],
          ['GoogleContainerTools/distroless', 'Minimal container images.'],
          ['chainguard-dev/apko', 'Build SBOM-backed container images.'],
          ['chainguard-dev/melange', 'Package builder for Chainguard/Wolfi.'],
          ['wolfi-dev/os', 'Security-focused Linux distro for containers.'],
          ['kubernetes/kubernetes', 'Kubernetes core.'],
          ['argoproj/argo-cd', 'GitOps CD.'],
          ['argoproj/argo-workflows', 'Kubernetes workflows.'],
          ['fluxcd/flux2', 'GitOps toolkit.'],
          ['helm/helm', 'Kubernetes package manager.'],
          ['kubernetes-sigs/kustomize', 'Kubernetes config customization.'],
          ['hashicorp/terraform', 'Infrastructure as code.'],
          ['ansible/ansible', 'Configuration management.'],
          ['pulumi/pulumi', 'Infrastructure as code.'],
          ['crossplane/crossplane', 'Cloud-native control plane.'],
          ['aws/aws-cdk', 'AWS Cloud Development Kit.'],
          ['cdk8s-team/cdk8s', 'Kubernetes CDK.'],
          ['envoyproxy/envoy', 'Edge/service proxy.'],
          ['istio/istio', 'Service mesh.'],
          ['linkerd/linkerd2', 'Service mesh.'],
          ['hashicorp/consul', 'Service networking/security.'],
          ['Kong/kong', 'API gateway.'],
          ['TykTechnologies/tyk', 'API gateway.'],
          ['krakend/krakend-ce', 'API gateway.']
        ]
      },
      {
        id: 'network-zerotrust',
        label: 'Network, zero trust, VPN & secure comms',
        entries: [
          ['WireGuard/wireguard-linux', 'WireGuard kernel implementation.'],
          ['tailscale/tailscale', 'WireGuard-based zero-trust networking.'],
          ['OpenVPN/openvpn', 'OpenVPN.'],
          ['netbirdio/netbird', 'WireGuard overlay network.'],
          ['gravitational/teleport', 'Zero-trust access plane.'],
          ['pomerium/pomerium', 'Identity-aware proxy.'],
          ['openziti/ziti', 'Zero-trust overlay network.'],
          ['cloudflare/cloudflared', 'Cloudflare Tunnel connector.'],
          ['Ylianst/MeshCentral', 'Remote management.'],
          ['rustdesk/rustdesk', 'Open-source remote desktop.'],
          ['element-hq/synapse', 'Matrix homeserver.'],
          ['element-hq/element-web', 'Matrix client.'],
          ['RocketChat/Rocket.Chat', 'Secure chat/collaboration.'],
          ['mattermost/mattermost', 'Slack-like collaboration.'],
          ['zulip/zulip', 'Threaded team chat.'],
          ['signalapp/Signal-Server', 'Signal server.'],
          ['signalapp/Signal-Android', 'Signal Android client.'],
          ['mailcow/mailcow-dockerized', 'Mail-server suite.'],
          ['docker-mailserver/docker-mailserver', 'Production-ready mail server.'],
          ['postalserver/postal', 'Mail server for sending.'],
          ['stalwartlabs/stalwart', 'All-in-one mail server.'],
          ['PowerDNS/pdns', 'Authoritative DNS.'],
          ['coredns/coredns', 'DNS server.']
        ]
      },
      {
        id: 'crypto-iam-pki',
        label: 'Cryptography, secrets, IAM & PKI',
        entries: [
          ['openssl/openssl', 'TLS/crypto library.'],
          ['jedisct1/libsodium', 'Easy-to-use crypto library.'],
          ['tink-crypto/tink', 'Modern crypto API.'],
          ['Legrandin/pycryptodome', 'Python crypto library.'],
          ['gpg/gnupg', 'GnuPG.'],
          ['FiloSottile/age', 'Simple file encryption.'],
          ['jedisct1/minisign', 'Minimal signing tool.'],
          ['hashicorp/vault', 'Secrets management.'],
          ['getsops/sops', 'Encrypted file secrets.'],
          ['Infisical/infisical', 'Secrets-management platform.'],
          ['dani-garcia/vaultwarden', 'Bitwarden-compatible server.'],
          ['bitwarden/server', 'Bitwarden server.'],
          ['zx2c4/password-store', 'pass password manager.'],
          ['keepassxreboot/keepassxc', 'KeePassXC.'],
          ['cryptomator/cryptomator', 'Client-side cloud encryption.'],
          ['torproject/tor', 'Tor.'],
          ['Whonix/Whonix', 'Anonymity-focused OS.'],
          ['external-secrets/external-secrets', 'Kubernetes external secrets.'],
          ['bitnami-labs/sealed-secrets', 'Encrypted Kubernetes secrets.'],
          ['cert-manager/cert-manager', 'Kubernetes certificate management.'],
          ['smallstep/certificates', 'Step CA.'],
          ['letsencrypt/boulder', "Let's Encrypt CA."],
          ['keycloak/keycloak', 'Identity/access management.'],
          ['ory/hydra', 'OAuth2/OIDC server.'],
          ['ory/kratos', 'Identity/user management.'],
          ['zitadel/zitadel', 'Identity management.'],
          ['goauthentik/authentik', 'Identity provider.'],
          ['casdoor/casdoor', 'UI-first identity platform.'],
          ['supertokens/supertokens-core', 'Auth SDK/backend.'],
          ['nextauthjs/next-auth', 'Authentication for Next.js.'],
          ['oauth2-proxy/oauth2-proxy', 'OAuth2 proxy.'],
          ['onelogin/python3-saml', 'SAML toolkit.'],
          ['krb5/krb5', 'MIT Kerberos.'],
          ['openfga/openfga', 'Fine-grained authorization.'],
          ['authzed/spicedb', 'Permission database.'],
          ['cerbos/cerbos', 'Authorization engine.']
        ]
      },
      {
        id: 'hardening',
        label: 'Host, OS & browser hardening',
        entries: [
          ['dev-sec/ansible-collection-hardening', 'Linux/Windows hardening roles.'],
          ['CISOfy/lynis', 'Security-auditing tool.'],
          ['openssh/openssh-portable', 'OpenSSH.'],
          ['sudo-project/sudo', 'sudo.'],
          ['SELinuxProject/selinux', 'SELinux userspace.'],
          ['netblue30/firejail', 'Linux application sandbox.'],
          ['objective-see/LuLu', 'macOS firewall.'],
          ['objective-see/BlockBlock', 'macOS persistence blocker.'],
          ['gorhill/uBlock', 'Browser content blocker.'],
          ['brave/brave-browser', 'Privacy-focused browser.']
        ]
      },
      {
        id: 'backup-storage',
        label: 'Backup, resilience & storage',
        entries: [
          ['restic/restic', 'Fast, secure backup.'],
          ['borgbackup/borg', 'Deduplicating backup tool.'],
          ['rclone/rclone', 'Cloud-storage sync.'],
          ['minio/minio', 'S3-compatible object storage.']
        ]
      },
      {
        id: 'soar',
        label: 'Automation, SOAR & workflow',
        entries: [
          ['StackStorm/st2', 'Event-driven automation / SOAR.'],
          ['Shuffle/Shuffle', 'Open-source SOAR.'],
          ['n8n-io/n8n', 'Workflow automation.'],
          ['tektoncd/pipeline', 'Kubernetes-native CI/CD pipelines.'],
          ['tektoncd/chains', 'Tekton supply-chain provenance.']
        ]
      },
      {
        id: 'ai-ml-security',
        label: 'AI/ML & data security',
        entries: [
          ['Trusted-AI/adversarial-robustness-toolbox', 'Adversarial-ML toolkit.'],
          ['cleverhans-lab/cleverhans', 'Adversarial-example library.'],
          ['Harry24k/adversarial-attacks-pytorch', 'PyTorch adversarial attacks.'],
          ['bethgelab/foolbox', 'Adversarial-attacks toolbox.'],
          ['great-expectations/great_expectations', 'Data validation.'],
          ['evidentlyai/evidently', 'ML monitoring.'],
          ['whylabs/whylogs', 'Dataset logging/profiling.'],
          ['mlflow/mlflow', 'ML-lifecycle platform.'],
          ['clearml/clearml', 'MLOps platform.'],
          ['iterative/dvc', 'Data/version control for ML.'],
          ['iterative/cml', 'Continuous ML.'],
          ['huggingface/transformers', 'ML model library.'],
          ['huggingface/huggingface_hub', 'Hugging Face Hub client.'],
          ['huggingface/safetensors', 'Safer tensor serialization.'],
          ['adap/flower', 'Federated learning.'],
          ['FedML-AI/FedML', 'Federated-learning framework.'],
          ['NVIDIA/NVFlare', 'NVIDIA federated learning.'],
          ['tensorflow/federated', 'TensorFlow Federated.'],
          ['OpenMined/PySyft', 'Privacy-preserving ML.'],
          ['OpenMined/PipelineDP', 'Differential-privacy pipeline.'],
          ['IBM/differential-privacy-library', 'Differential-privacy library.'],
          ['gramineproject/gramine', 'SGX/library OS.'],
          ['occlum/occlum', 'Confidential-computing library OS.'],
          ['edgelesssys/constellation', 'Confidential Kubernetes.'],
          ['apache/incubator-teaclave', 'Confidential-computing platform.']
        ]
      },
      {
        id: 'blockchain',
        label: 'Blockchain & smart-contract security',
        entries: [
          ['crytic/slither', 'Solidity static analysis.'],
          ['crytic/echidna', 'Ethereum smart-contract fuzzer.'],
          ['Consensys/mythril', 'EVM bytecode security analysis.'],
          ['trailofbits/manticore', 'Symbolic execution for contracts/binaries.'],
          ['foundry-rs/foundry', 'Ethereum dev/testing framework.'],
          ['NomicFoundation/hardhat', 'Ethereum development environment.'],
          ['ethereum/go-ethereum', 'Ethereum client.'],
          ['solana-labs/solana', 'Solana blockchain.'],
          ['hyperledger/fabric', 'Enterprise blockchain.'],
          ['solid/specification', 'Solid decentralized-data spec.'],
          ['nodeSolidServer/node-solid-server', 'Solid server.'],
          ['inrupt/solid-client-js', 'Solid JavaScript client.']
        ]
      },
      {
        id: 'osint',
        label: 'OSINT tools',
        entries: [
          ['laramies/theHarvester', 'Email/subdomain/domain OSINT.'],
          ['smicallef/spiderfoot', 'OSINT automation.'],
          ['lanmaster53/recon-ng', 'Reconnaissance framework.'],
          ['sherlock-project/sherlock', 'Social-media username search.'],
          ['megadose/holehe', 'Check email registration across sites.'],
          ['qeeqbox/social-analyzer', 'Social-media OSINT.'],
          ['sundowndev/phoneinfoga', 'Phone-number OSINT.'],
          ['JAQA-Life/flowsint', 'OSINT graph/investigation platform (Apache-2.0, JAQA-Life).']
        ]
      },
      {
        id: 'grc',
        label: 'GRC, compliance & awareness',
        entries: [
          ['gophish/gophish', 'Phishing-simulation framework.'],
          ['coreinfrastructure/best-practices-badge', 'CII Best Practices badge.'],
          ['ossf/scorecard', 'OpenSSF Scorecard for repo security health.'],
          ['ossf/criticality_score', 'Measure open-source criticality.']
        ]
      }
    ]
  },
  {
    id: 'supply-chain',
    label: 'Supply chain',
    blurb: 'Software supply-chain security: SBOMs, vulnerability intelligence, provenance and signing, reproducible builds, registries, CI/CD and secrets.',
    categories: [
      {
        id: 'sbom',
        label: 'SBOM (Software Bill of Materials)',
        entries: [
          ['anchore/syft', 'Generate SBOMs.'],
          ['anchore/grype', 'Scan SBOMs/images/files for vulnerabilities.'],
          ['aquasecurity/trivy', 'SBOM/vulnerability/config scanning.'],
          ['CycloneDX/cyclonedx-python', 'CycloneDX SBOM tooling.'],
          ['CycloneDX/cdxgen', 'Generate CycloneDX SBOMs from many ecosystems.'],
          ['spdx/tools-python', 'SPDX tooling.'],
          ['CycloneDX/sbom-utility', 'Validate/inspect SBOMs.'],
          ['microsoft/sbom-tool', 'Microsoft SBOM tool.'],
          ['DependencyTrack/dependency-track', 'SBOM/component vulnerability platform.'],
          ['oss-review-toolkit/ort', 'Licence/component compliance.'],
          ['nexB/scancode-toolkit', 'Code/licence/component scanner.'],
          ['fossology/fossology', 'FOSS licence/copyright compliance.'],
          ['licensee/licensee', 'Licence detection.']
        ]
      },
      {
        id: 'vuln-intel',
        label: 'Vulnerability intelligence & exploitability',
        entries: [
          ['google/osv-scanner', 'Scan using the OSV database.'],
          ['ossf/osv-schema', 'Open Source Vulnerabilities schema.'],
          ['github/advisory-database', 'GitHub Security Advisories.'],
          ['CVEProject/cvelistV5', 'CVE list in JSON.'],
          ['FIRSTdotorg/epss-data-api', 'Exploit Prediction Scoring System data.'],
          ['cisagov/kev-data', 'CISA Known Exploited Vulnerabilities catalog.'],
          ['openvex/spec', 'Vulnerability Exploitability eXchange.'],
          ['oasis-tcs/csaf', 'CSAF standard.'],
          ['dependency-check/DependencyCheck', 'OWASP Dependency-Check.'],
          ['pypa/pip-audit', 'Python dependency auditing.'],
          ['rustsec/rustsec', 'Rust dependency auditing (cargo-audit).'],
          ['golang/vuln', 'Go vulnerability checking (govulncheck).'],
          ['snyk/cli', 'Snyk CLI.'],
          ['renovatebot/renovate', 'Dependency-update automation.'],
          ['pyupio/safety', 'Python dependency security checks.'],
          ['ossf/malicious-packages', 'Known-malicious-package database.']
        ]
      },
      {
        id: 'provenance-signing',
        label: 'Provenance, attestation & signing',
        entries: [
          ['slsa-framework/slsa', 'Supply-chain Levels for Software Artifacts.'],
          ['slsa-framework/slsa-github-generator', 'SLSA generators for GitHub Actions.'],
          ['slsa-framework/slsa-verifier', 'Verify SLSA provenance.'],
          ['in-toto/in-toto', 'Supply-chain integrity framework.'],
          ['in-toto/in-toto-golang', 'Go in-toto implementation.'],
          ['in-toto/attestation', 'Attestation format.'],
          ['sigstore/cosign', 'Sign/verify artifacts, SBOMs, signatures.'],
          ['sigstore/fulcio', 'Certificate authority for Sigstore.'],
          ['sigstore/rekor', 'Transparency log.'],
          ['sigstore/policy-controller', 'Kubernetes admission policy for Sigstore.'],
          ['sigstore/sigstore', 'Sigstore client/spec resources.'],
          ['notaryproject/notation', 'Artifact signing/verification.'],
          ['notaryproject/notary', 'Docker Content Trust / Notary.'],
          ['theupdateframework/python-tuf', 'The Update Framework in Python.'],
          ['theupdateframework/go-tuf', 'TUF in Go.'],
          ['secure-systems-lab/securesystemslib', 'Secure-systems library.']
        ]
      },
      {
        id: 'reproducible-builds',
        label: 'Build integrity & reproducible builds',
        entries: [
          ['reproducible-builds/diffoscope', 'Compare build artifacts.'],
          ['kpcyrd/rebuilderd', 'Rebuild and verify packages.'],
          ['NixOS/nixpkgs', 'Purely functional package management.'],
          ['bazelbuild/bazel', 'Hermetic build system.'],
          ['gradle/gradle', 'JVM build tool.'],
          ['apache/maven', 'Java build tool.'],
          ['sbt/sbt', 'Scala build tool.'],
          ['rust-lang/cargo', 'Rust package manager/build tool.'],
          ['golang/go', 'Go toolchain.'],
          ['dotnet/sdk', '.NET SDK.'],
          ['NuGet/NuGet.Client', 'NuGet client.'],
          ['rubygems/rubygems', 'RubyGems.'],
          ['composer/composer', 'PHP package manager.'],
          ['npm/cli', 'npm client.'],
          ['pnpm/pnpm', 'Fast, disk-efficient Node package manager.'],
          ['yarnpkg/berry', 'Yarn modern.'],
          ['pypa/pip', 'Python package installer.'],
          ['python-poetry/poetry', 'Python dependency management.'],
          ['pypa/pipenv', 'Python workflow tool.']
        ]
      },
      {
        id: 'registries',
        label: 'Package registries & artifact repositories',
        entries: [
          ['verdaccio/verdaccio', 'Private npm registry.'],
          ['pypi/warehouse', 'PyPI codebase.'],
          ['rubygems/rubygems.org', 'RubyGems.org.'],
          ['distribution/distribution', 'Docker/OCI registry components.']
        ]
      },
      {
        id: 'cicd-supply-chain',
        label: 'CI/CD supply-chain security',
        entries: [
          ['ossf/scorecard-action', 'GitHub Action for Scorecard.'],
          ['step-security/harden-runner', 'GitHub Actions egress/behaviour monitoring.'],
          ['github/codeql-action', 'CodeQL CI integration.'],
          ['github/codeql', 'CodeQL CLI/resources.'],
          ['jenkinsci/jenkins', 'Jenkins.'],
          ['gitlabhq/gitlabhq', 'GitLab CE.'],
          ['go-gitea/gitea', 'Gitea.'],
          ['woodpecker-ci/woodpecker', 'Woodpecker CI.'],
          ['harness/gitness', 'Drone/Gitness CI.'],
          ['actions/runner', 'GitHub Actions runner.']
        ]
      },
      {
        id: 'secrets-scanning',
        label: 'Secrets & sensitive data in source',
        entries: [
          ['gitleaks/gitleaks', 'Secret scanner.'],
          ['trufflesecurity/trufflehog', 'Credential scanner.'],
          ['Yelp/detect-secrets', 'Secret detection.'],
          ['secretlint/secretlint', 'Lint secrets in text.'],
          ['awslabs/git-secrets', 'Prevent secrets in git.']
        ]
      }
    ]
  },
  {
    id: 'medical',
    label: 'Medical & health',
    blurb: 'Health-IT standards, EHR/clinical systems, medical imaging, clinical NLP/de-identification, genomics, connected devices and healthcare security.',
    categories: [
      {
        id: 'health-standards',
        label: 'FHIR / HL7 / DICOM standards & interoperability',
        entries: [
          ['FHIR/fhir', 'HL7 FHIR specification/resources.'],
          ['google/android-fhir', 'FHIR SDK for Android.'],
          ['google/fhir', 'FHIR protocol buffers / FHIRPath.'],
          ['microsoft/fhir-server', 'Microsoft FHIR server.'],
          ['hapifhir/hapi-fhir', 'Java FHIR library/server.'],
          ['HL7/smart-app-launch', 'SMART App Launch standard.'],
          ['smart-on-fhir/health-cards', 'FHIR Health Cards.'],
          ['smart-on-fhir/client-js', 'FHIR client library.'],
          ['LinuxForHealth/FHIR', 'Health interoperability / FHIR tooling.'],
          ['FHIR/sushi', 'FHIR Shorthand compiler.']
        ]
      },
      {
        id: 'ehr-clinical',
        label: 'EHR / EMR / clinical systems',
        entries: [
          ['openemr/openemr', 'OpenEMR EHR.'],
          ['openmrs/openmrs-core', 'OpenMRS medical-record system.'],
          ['Bahmni/bahmni-core', 'Bahmni EHR/HIS.'],
          ['openboxes/openboxes', 'Medical supply chain / inventory.'],
          ['I-TECH-UW/openelis-global-2', 'Laboratory information system.'],
          ['senaite/senaite.lims', 'LIMS.'],
          ['LabKey/server', 'Biomedical data platform.'],
          ['OpenClinica/OpenClinica', 'Clinical data capture.'],
          ['synthetichealth/synthea', 'Synthetic patient generator.'],
          ['MIT-LCP/mimic-code', 'MIMIC clinical-database code.'],
          ['OHDSI/Atlas', 'OMOP OHDSI web app.'],
          ['OHDSI/WebAPI', 'OHDSI WebAPI.'],
          ['OHDSI/Achilles', 'OMOP data-quality profiling.'],
          ['pharmaverse/admiral', 'Clinical-trial ADaM/CDISC R tooling.']
        ]
      },
      {
        id: 'imaging',
        label: 'Medical imaging, DICOM & PACS',
        entries: [
          ['pydicom/pydicom', 'Python DICOM library.'],
          ['DCMTK/dcmtk', 'DICOM toolkit.'],
          ['dcm4che/dcm4che', 'DICOM/PACS toolkit.'],
          ['jodogne/OrthancMirror', 'Lightweight DICOM server (Orthanc).'],
          ['OHIF/Viewers', 'Open-source medical-imaging viewer.'],
          ['Slicer/Slicer', '3D Slicer medical-imaging platform.'],
          ['InsightSoftwareConsortium/ITK', 'Imaging toolkit.'],
          ['Kitware/VTK', 'Visualization toolkit.'],
          ['Project-MONAI/MONAI', 'Healthcare imaging AI framework.'],
          ['innolitics/dicom-standard', 'Searchable DICOM standard docs.'],
          ['microsoft/presidio', 'PII detection/anonymization (incl. DICOM).']
        ]
      },
      {
        id: 'clinical-nlp',
        label: 'Clinical NLP, de-identification & synthetic data',
        entries: [
          ['apache/ctakes', 'Clinical text analysis and knowledge extraction.'],
          ['medspacy/medspacy', 'Clinical NLP with spaCy.'],
          ['explosion/spaCy', 'Industrial NLP.'],
          ['sdv-dev/SDV', 'Synthetic-data generation.']
        ]
      },
      {
        id: 'genomics',
        label: 'Genomics, bioinformatics & lab automation',
        entries: [
          ['samtools/samtools', 'Sequence-alignment tools.'],
          ['samtools/bcftools', 'Variant calling/manipulation.'],
          ['broadinstitute/gatk', 'Genome Analysis Toolkit.'],
          ['nextflow-io/nextflow', 'Scientific workflow system.'],
          ['common-workflow-language/cwltool', 'Common Workflow Language.'],
          ['galaxyproject/galaxy', 'Biomedical research platform.'],
          ['nf-core/modules', 'Shared bioinformatics modules.'],
          ['ga4gh/data-repository-service-schemas', 'GA4GH data/authorization standards.'],
          ['phenopackets/phenopacket-schema', 'Phenotypic-data exchange.'],
          ['Opentrons/opentrons', 'Lab-automation platform.'],
          ['PyLabRobot/pylabrobot', 'Lab-robot control framework.']
        ]
      },
      {
        id: 'iomt',
        label: 'Connected devices, diabetes tech & closed-loop',
        entries: [
          ['openaps/oref0', 'Open artificial-pancreas algorithms.'],
          ['nightscout/cgm-remote-monitor', 'Remote CGM/data platform (Nightscout).'],
          ['nightscout/AndroidAPS', 'Android artificial pancreas.'],
          ['LoopKit/Loop', 'iOS closed-loop insulin-delivery ecosystem.']
        ]
      },
      {
        id: 'telehealth',
        label: 'Telehealth, mHealth & remote monitoring',
        entries: [
          ['jitsi/jitsi-meet', 'Video conferencing.'],
          ['livekit/livekit', 'Realtime audio/video infrastructure.'],
          ['pion/webrtc', 'Go WebRTC implementation.'],
          ['versatica/mediasoup', 'WebRTC SFU.'],
          ['ResearchKit/ResearchKit', 'Apple research/mHealth framework.'],
          ['carekit-apple/CareKit', 'Care/health-tracking framework.'],
          ['getodk/collect', 'Mobile data collection for field health.']
        ]
      },
      {
        id: 'public-health',
        label: 'Public health & genomic surveillance',
        entries: [
          ['nextstrain/nextclade', 'Viral sequence annotation/QC.'],
          ['nextstrain/auspice', 'Genomic-epidemiology visualization.'],
          ['cov-lineages/pango-designation', 'SARS-CoV-2 lineage designation.'],
          ['eu-digital-green-certificates/dgc-gateway', 'Digital Green Certificate gateway.']
        ]
      }
    ]
  }
];

