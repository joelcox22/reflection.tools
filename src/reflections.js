import { useState, useEffect, Fragment } from "react";
import { Bar } from "react-chartjs-2";

const query = `
  query ($address: String!) {
    ethereum(network: bsc) {
      transfers(receiver: {is: $address}) {
        amount
        currency {
          name
          symbol
          tokenId
          tokenType
          decimals
          address
        }
        date {
          date
        }
        transaction {
          hash
          txFrom {
            address
          }
        }
        sender {
          address
          annotation
          smartContract {
            currency {
              name
            }
            contractType
          }
        }
        receiver {
          address
        }
      }
    }
  }
`;

const sendersWeCareAbout = {
  "0xfbab1d829e36efbd13642229eae2964004f38c41": "Evergrow",
  "0x9aacfd4ff2a965779cff25e370b89b788222e6b9": "Crypter",
  "0xfdac78ff52dead5a5f0b89b32a8ea66a01979f31": "Reflecto",
  "0xdedf5fa8ec49255bc2c7bfadcd18be2c0d228f99": "Reflecto",
  "0x7bda2f125b0e63bb332e1e6342be381e28efaeb6": "Reflecto",
  "0xd93a7af8d6292030947b13dd2942a8d2baca649b": "Santa Coin",
  "0x62c73478676848b96b729a3f2e25412735154df0": "Corsac"
};

const uniqueSenders = Object.values(sendersWeCareAbout).filter(
  (v, i, a) => a.indexOf(v) === i
);

const colors = uniqueSenders.reduce((acc, sender, index) => {
  acc[sender] = `hsl(${(index / uniqueSenders.length) * 270} 100% 50%)`;
  return acc;
}, {});

export function Reflections() {
  const [address, setAddress] = useState(() => {
    return window.location.hash.replace('#', '') ?? localStorage.getItem("walletAddress") ?? "";
  });
  const [debouncedAddress, setDobouncedAddress] = useState(address);
  const [result, setResult] = useState(address);
  const [errors, setErrors] = useState();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDobouncedAddress(address);
    }, 500);
    localStorage.setItem("walletAddress", address);
    return () => {
      clearTimeout(timer);
    };
  }, [address]);

  useEffect(() => {

    window.location.hash = debouncedAddress;

    if (!debouncedAddress.match(/^0x[A-Za-z0-9]{40}$/)) {
      setErrors("Invalid wallet address.");
      setLoading(false);
      setResult(null);
      return;
    }

    setLoading(true);
    setErrors(false);
    fetch("https://graphql.bitquery.io/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        variables: JSON.stringify({
          address: debouncedAddress
        })
      })
    })
      .then((res) => res.json())
      .then((res) => {
        setLoading(false);
        if (res.errors) {
          setErrors(res.errors);
          setResult(null);
          return;
        }

        const incomeCurrencies = [];

        const sentTotals = res.data.ethereum.transfers.reduce(
          (acc, transfer) => {
            const sender = sendersWeCareAbout[transfer.sender.address];
            if (!sender) return acc;
            const date = transfer.date.date;
            const currency = transfer.currency.symbol;
            acc[date] = acc[date] || {};
            acc[date][currency] = acc[date][currency] || {};
            acc[date][currency][sender] = acc[date][currency][sender] || 0;
            acc[date][currency][sender] += transfer.amount;
            if (!incomeCurrencies.includes(currency))
              incomeCurrencies.push(currency);
            return acc;
          },
          {}
        );

        const chartData = {};

        incomeCurrencies.forEach((currency) => {
          const chart = (chartData[currency] = {
            labels: [],
            datasets: {}
          });
          Object.entries(sentTotals).forEach(([date, income]) => {
            chart.labels.push(date);
          });
          uniqueSenders.forEach((sender) => {
            chart.datasets[sender] = {
              label: sender,
              backgroundColor: colors[sender],
              data: []
            };
          });
        });

        Object.entries(sentTotals).forEach(([date, income]) => {
          incomeCurrencies.forEach((currency) => {
            uniqueSenders.forEach((sender) => {
              chartData[currency].datasets[sender].data.push(
                income[currency]?.[sender] || 0
              );
            });
          });
        });

        incomeCurrencies.forEach((currency) => {
          const chart = chartData[currency];
          chart.datasets = Object.values(chart.datasets).filter((set) => {
            const sum = set.data.reduce((acc, value) => acc + value, 0);
            return sum > 0;
          });
        });

        setResult(chartData);
      });
  }, [debouncedAddress]);

  return (
    <>
      <p>Enter your wallet address</p>
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <div style={{ maxWidth: 600, margin: 'auto' }}>
        {debouncedAddress === "" ? null : errors ? (
          <pre>{JSON.stringify(errors, null, 4)}</pre>
        ) : loading ? (
          <p>Loading...</p>
        ) : (
          result && Object.entries(result).map(([currency, chart]) => (
            <Fragment key={currency+debouncedAddress}>
              <h1>{currency}</h1>
              <Bar
                data={chart}
                width={100}
                height={50}
                options={{
                  scales: {
                    x: {
                      stacked: true
                    },
                    y: {
                      stacked: true
                    }
                  }
                }}
              />
            </Fragment>
          ))
        )}
      </div>
    </>
  );
}
