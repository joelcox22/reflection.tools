import { useState, useEffect, Fragment } from "react";
import { Bar } from "react-chartjs-2";

const sendersWeCareAbout = {
  "0xfbab1d829e36efbd13642229eae2964004f38c41": "Evergrow", // BUSD
  "0x9aacfd4ff2a965779cff25e370b89b788222e6b9": "Crypter", // BUSD
  "0xfdac78ff52dead5a5f0b89b32a8ea66a01979f31": "Reflecto", // BUSD
  "0xdedf5fa8ec49255bc2c7bfadcd18be2c0d228f99": "Reflecto", // EGC
  "0x7bda2f125b0e63bb332e1e6342be381e28efaeb6": "Reflecto", // CRYPT
  "0x65ab1b70c70011e4ea5a7268df159480c47e7f98": "Reflecto", // SHIB
  "0xd93a7af8d6292030947b13dd2942a8d2baca649b": "Santa Coin", // BUSD
  "0x62c73478676848b96b729a3f2e25412735154df0": "Corsac", // BUSD
  "0x35074b2ab33048c84f37744484ee63e469dc68b8": "Techno Floki", // DOGE
  "0xf8b814824efd4a2d238fcaa46f608bfd18236e8c": "ForeverGrow", // BUSD
  "0x9e90d5e53baa6254be7db9cdb4afb4c60f9aacf7": "Y-5 Finance", // BUSD
  "0xa383829c57a1b7ccbf7c6cf00c4dea06a8c2e814": "Rematic EGC", // EGC
  "0x0b4a50a097848eea10e8848459ec1539645e5175": "Boda V2", // BUSD
  "0x284c54b37f2ac667d84f0aa5d5bdfc8d3687304a": "Reflex Finance", // BUSD
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
    return window.location.hash.replace('#', '') || localStorage.getItem("walletAddress") || '';
  });
  const [debouncedAddress, setDobouncedAddress] = useState(address);
  const [result, setResult] = useState(address);
  const [errors, setErrors] = useState();
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDobouncedAddress(address.trim());
    }, 500);
    localStorage.setItem("walletAddress", address);
    window.addEventListener('hashchange', () => {
      const updatedAddress = window.location.hash.replace('#', '');
      if (updatedAddress !== address) {
        setAddress(updatedAddress);
        setDobouncedAddress(updatedAddress);
      }
    });
    return () => {
      clearTimeout(timer);
    };
  }, [address]);

  useEffect(() => {

    window.location.hash = debouncedAddress;

    if (debouncedAddress === '') {
      window.gtag('event', 'empty-wallet-address');
      setLoading(false);
      setErrors(false);
      setResult(null);
      return;
    } else if (!debouncedAddress.match(/^0x[A-Za-z0-9]{40}$/)) {
      setErrors("Invalid wallet address.");
      setLoading(false);
      setResult(null);
      window.gtag('event', 'invalid-wallet-address');
      return;
    }

    window.gtag('event', 'lookup-wallet-address');

    setLoading(true);
    setErrors(false);
    const query = new URLSearchParams({
      module: 'account',
      action: 'tokentx',
      address: debouncedAddress,
      sort: 'ASC',
    });
    fetch(`https://api.bscscan.com/api?${query.toString()}`)
      .then((res) => res.json())
      .then((res) => {
        setLoading(false);
        if (res.message === 'NOTOK') {
          setErrors(res.result);
          window.gtag('event', 'rate-limited');
          return;
        }

        if (res.errors) {
          window.gtag('event', 'data-lookup-error');
          setErrors(res.errors);
          setResult(null);
          return;
        }

        const totals = {};
        const incomeCurrencies = [];

        const sentTotals = res.result.reduce(
          (acc, transfer) => {
            const sender = sendersWeCareAbout[transfer.from];
            if (!sender) return acc;
            const date = new Date((transfer.timeStamp-0)*1e3).toISOString().split('T')[0];
            const currency = transfer.tokenSymbol;
            const amount = (transfer.value - 0) / (('1' + new Array(transfer.tokenDecimal - 0).fill('0').join('')) - 0);
            acc[date] = acc[date] || {};
            acc[date][currency] = acc[date][currency] || {};
            acc[date][currency][sender] = acc[date][currency][sender] || 0;
            acc[date][currency][sender] += amount;
            if (!incomeCurrencies.includes(currency))
              incomeCurrencies.push(currency);
            totals[currency] = totals[currency] || {};
            totals[currency][sender] = (totals[currency][sender] || 0) + amount;
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
              label: `${sender} (${Math.round(totals[currency][sender]).toLocaleString()})`,
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
  }, [debouncedAddress, retry]);

  return (
    <>
      <p>Enter your wallet address</p>
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <div style={{ maxWidth: 600, margin: 'auto', padding: 20 }}>
        {debouncedAddress === "" ? (
          <>
            <p>This tool will fetch data about reflective tokens ({uniqueSenders.join(', ')}), and display how much you're earning from and in each token in a single place.</p>
            <p>When you enter in your address, your browser makes a graphql query directly to https://api.bscscan.com/ to fetch all of your transactions, which are then processed client-side in your browser into simple graphs.</p>
            <p>There's a good chance this tool might break sometime. It's just been hacked together in a few hours so far, and is not using any API key, so currently limited to 1 request every 5 seconds.</p>
            <p>Feel free to log any issues <a href="https://github.com/joelcox22/reflection.tools/issues" target="_blank" rel="noreferrer">in Github Issues</a>. <a href="https://github.com/joelcox22/reflection.tools" target="_blank" rel="noreferrer">Full source code is available there too</a>.</p>
            <p>Google analytics is setup purely so I can see how many people use this and if it's worth continuing development. Cookies are disabled - it's only interaction events with the page being logged.</p>
            <p>Pull requests are welcome if anyone wants to help out or add more tokens.</p>
            <p>I'd love to find a way to also fetch and display pending rewards from all of these tokens - if anyone knows how, please let me know via a Github Issue or something.</p>
          </>
        ) : errors ? (
          <>
            <pre>{JSON.stringify(errors, null, 4)}</pre>
            {typeof errors === 'string' && errors.includes('rate limit') && (
              <button onClick={() => {
                setRetry(retry + 1);
                window.gtag('event', 'refresh-because-rate-limited');
              }}>Click here to try again</button>
            )}
          </>
        ) : loading ? (
          <p>Loading...</p>
        ) : (
          result && Object.entries(result).map(([currency, chart]) => (
            <Fragment key={currency}>
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
