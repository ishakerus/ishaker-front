export const MachineBySerialQuery = `
  query MachineBySerial($serial: String) {
    machines(
      filters: { serial_number: { startsWith: $serial } }
      pagination: { pageSize: 2000 }
      sort: ["title:ASC"]
    ) {
      data {
        id
        attributes {
          type
          status
          title
          hostname
          description
          context
          anydesk_id
          tailscale_ip
          tailscale_hostname
          ssh_user
          ssh_port
          serial_number
          unity_version
          ssd_version
          bootstrap_version
          last_seen_at
          admin_comment
          client {
            data {
              id
              attributes {
                company
                country
                state
                city
              }
            }
          }
        }
      }
    }
  }
`;

export const AdminClientsQuery = `
  query AdminClients {
    clients(
      filters: { status: { eq: "client" } }
      pagination: { pageSize: 2000 }
      sort: ["company:ASC"]
    ) {
      data {
        id
        attributes {
          company
          country
          state
          city
          status
          contact {
            __typename
            ... on ComponentTelegramTelegram {
              telegram
            }
            ... on ComponentWhatsappWhatsapp {
              whatsapp
            }
          }
          machines(sort: ["title:ASC"], pagination: { pageSize: 2000 }) {
            data {
              id
              attributes {
                title
                anydesk_id
                serial_number
                tailscale_ip
                readiness
                fleet_status
                patch {
                  data {
                    id
                    attributes {
                      slug
                    }
                  }
                }
                machine_type {
                  data {
                    id
                    attributes {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const AdminMachinesQuery = `
  query AdminMachines {
    patches(
      pagination: { pageSize: 2000 }
      sort: ["id:DESC"]
    ) {
      data {
        id
        attributes {
          slug
          fix_summary
          isStable
        }
      }
    }
    machines(
      pagination: { pageSize: 2000 }
      sort: ["id:ASC"]
    ) {
      data {
        id
        attributes {
          title
          nickname
          anydesk_id
          serial_number
          readiness
          fleet_status
          machine_type {
            data {
              id
              attributes {
                name
              }
            }
          }
          patch {
            data {
              id
              attributes {
                slug
              }
            }
          }
          client {
            data {
              id
              attributes {
                company
                status
              }
            }
          }
        }
      }
    }
  }
`;

export const AdminPatchesQuery = `
  query AdminPatches {
    patches(
      pagination: { pageSize: 2000 }
      sort: ["id:DESC"]
    ) {
      data {
        id
        attributes {
          slug
          fix_summary
          isStable
        }
      }
    }
  }
`;
