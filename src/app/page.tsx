"use client";

import { useState, useEffect } from "react";
import { JsonRpcProvider, Contract, formatUnits, ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GemWallet } from "@/lib/gem-wallet";
import {
  Wallet,
  TrendingUp,
  Users,
  Trophy,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POOL_ADDRESS = "0x3d0d600385af49e9db119eb76b4327592c91f277";
const AXELAR_MULTISIG = "rNrjh1KGZk2jBR3wPfAQnoidtFFYQKbQn2";
const DESTINATION_CHAIN = "xrpl-evm";
const GAS_FEE_AMOUNT = "300000";
const EXPLORER_URL = "https://explorer.testnet.xrplevm.org";

const POOL_ABI = [
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "donations",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "donors",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getDonorCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalDonations",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const hex = (str: string): string => Buffer.from(str).toString("hex");

interface DonorData {
  address: string;
  amount: string;
  rank: number;
}

export default function DonationPage() {
  const [wallet, setWallet] = useState<GemWallet | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState("");
  const [totalRaised, setTotalRaised] = useState("0");
  const [myDonation, setMyDonation] = useState("0");
  const [donors, setDonors] = useState<DonorData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [contractConnected, setContractConnected] = useState<boolean | null>(
    null
  );
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showTxModal, setShowTxModal] = useState(false);

  useEffect(() => {
    const gemWallet = new GemWallet();
    setWallet(gemWallet);
    checkContractConnection();
  }, []);

  const checkContractConnection = async () => {
    try {
      const provider = new JsonRpcProvider("https://rpc.testnet.xrplevm.org");
      const contract = new Contract(POOL_ADDRESS, POOL_ABI, provider);

      await contract.totalDonations();
      setContractConnected(true);

      fetchDonationData();
    } catch (error) {
      console.error("Error connecting to contract:", error);
      setContractConnected(false);
    }
  };

  useEffect(() => {
    if (account) {
      fetchDonationData();
    }
  }, [account]);

  const fetchDonationData = async () => {
    setIsFetching(true);
    try {
      const provider = new JsonRpcProvider("https://rpc.testnet.xrplevm.org");
      const contract = new Contract(POOL_ADDRESS, POOL_ABI, provider);

      const total = await contract.totalDonations();
      setTotalRaised(formatUnits(total, 18));

      const donorCount = await contract.getDonorCount();
      console.log("Donor count from contract:", donorCount.toString());
      const donorList: DonorData[] = [];

      // Only fetch donors if count > 0
      if (Number(donorCount) > 0) {
        console.log(`Attempting to fetch ${donorCount} donors...`);
        for (let i = 0; i < Number(donorCount); i++) {
          try {
            console.log(`Fetching donor at index ${i}...`);
            const donorAddress = await contract.donors(i);
            console.log(`✓ Successfully fetched donor ${i}: ${donorAddress}`);

            // Check if donor address is not empty
            if (
              donorAddress &&
              typeof donorAddress === "string" &&
              donorAddress.trim() !== ""
            ) {
              try {
                const amount = await contract.donations(donorAddress);
                console.log(
                  `  - Donation amount: ${formatUnits(amount, 18)} XRP`
                );

                if (amount > BigInt(0)) {
                  donorList.push({
                    address: donorAddress,
                    amount: formatUnits(amount, 18),
                    rank: 0,
                  });
                }
              } catch (donationError) {
                console.warn(
                  `  - No donation data for address: ${donorAddress}`
                );
              }
            } else {
              console.warn(`  - Empty or invalid donor address at index ${i}`);
            }
          } catch (error) {
            console.error(`✗ Failed to fetch donor at index ${i}:`, error);
            // If the very first call fails, the contract state is inconsistent
            if (i === 0) {
              console.error(
                "Contract state inconsistency: donorCount > 0 but donors array is unreachable"
              );
              console.error(
                "This might indicate the contract has a corrupted state or the ABI doesn't match"
              );
              break;
            }
          }
        }
      } else {
        console.log("No donors in the contract (count is 0)");
      }

      console.log(
        `Successfully compiled ${donorList.length} donors out of ${donorCount} reported by contract`
      );

      donorList.sort(
        (a, b) => Number.parseFloat(b.amount) - Number.parseFloat(a.amount)
      );
      donorList.forEach((donor, index) => {
        donor.rank = index + 1;
      });

      setDonors(donorList);

      if (account) {
        try {
          const myAmount = await contract.donations(account);
          setMyDonation(formatUnits(myAmount, 18));
        } catch (error) {
          console.error("Error fetching my donation:", error);
          setMyDonation("0");
        }
      }
    } catch (error) {
      console.error("Error fetching donation data:", error);
      toast.error("Failed to fetch donation data");
    } finally {
      setIsFetching(false);
    }
  };

  const connectWallet = async () => {
    if (!wallet) return;

    try {
      const result = await wallet.logIn();
      if (result?.address) {
        setAccount(result.address);
        toast.success("Wallet Connected", {
          description: `Connected: ${result.address.slice(
            0,
            6
          )}...${result.address.slice(-4)}`,
        });
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      toast.error("Connection Failed", {
        description: "Please check if GemWallet is installed",
      });
    }
  };

  enum Command {
    DONATE = 0,
  }

  const encodedPayload = () => {
    const abiCoder = new ethers.AbiCoder();
    return abiCoder.encode(["uint8"], [Command.DONATE]).replace("0x", "");
  };

  const sendDonation = async () => {
    if (!wallet || !account || !donationAmount) return;

    setIsLoading(true);
    try {
      const amountInDrops = (
        Number.parseFloat(donationAmount) * 1_000_000
      ).toString();
      const totalAmount = (
        Number.parseFloat(amountInDrops) + Number.parseFloat(GAS_FEE_AMOUNT)
      ).toString();

      const payment = await wallet.requestPayment({
        TransactionType: "Payment",
        Amount: totalAmount,
        Destination: AXELAR_MULTISIG,
        Account: account,
        Memos: [
          {
            Memo: {
              MemoType: hex("payload"),
              MemoData: encodedPayload(),
            },
          },
          {
            Memo: {
              MemoType: hex("type"),
              MemoData: hex("interchain_transfer"),
            },
          },
          {
            Memo: {
              MemoType: hex("destination_chain"),
              MemoData: hex(DESTINATION_CHAIN),
            },
          },
          {
            Memo: {
              MemoType: hex("destination_address"),
              MemoData: hex(POOL_ADDRESS.replace("0x", "")),
            },
          },
          {
            Memo: {
              MemoType: hex("gas_fee_amount"),
              MemoData: hex(GAS_FEE_AMOUNT),
            },
          },
        ],
      });

      if (payment) {
        setTxHash(payment);
        setShowTxModal(true);
        toast.success("Donation Sent!", {
          description: `Transaction submitted successfully`,
        });
        setDonationAmount("");
        setTimeout(() => {
          fetchDonationData();
        }, 5000);
      }
    } catch (error) {
      console.error("Error sending donation:", error);
      toast.error("Transaction Failed", {
        description: "Failed to send donation",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />

      <div className="relative">
        <header className="border-b border-border/40 backdrop-blur-xl bg-background/80">
          <div className="container mx-auto px-4 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-chart-1 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-balance">
                  XRPL Cross-Chain Donations
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  {contractConnected === null ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Connecting to contract...</span>
                    </div>
                  ) : contractConnected ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Contract connected</span>
                      </div>
                      <a
                        href={`${EXPLORER_URL}/address/${POOL_ADDRESS}?tab=transactions`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/50 hover:bg-accent transition-colors text-xs font-mono text-foreground/80 hover:text-foreground"
                      >
                        <span>
                          {POOL_ADDRESS.slice(0, 6)}...{POOL_ADDRESS.slice(-4)}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <XCircle className="w-3 h-3" />
                      <span>Contract connection failed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!account ? (
              <Button onClick={connectWallet} size="lg" className="gap-2">
                <Wallet className="w-4 h-4" />
                Connect Gem Wallet
              </Button>
            ) : (
              <div className="px-4 py-2 rounded-lg bg-accent/50 border border-border">
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="font-mono text-sm font-medium">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </p>
              </div>
            )}
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <Card className="p-6 bg-gradient-to-br from-card to-accent/5 border-border/50 backdrop-blur">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-chart-1/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-chart-1" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Total Raised
                </h3>
              </div>
              <p className="text-3xl font-bold text-balance">
                {Number.parseFloat(totalRaised).toFixed(2)} XRP
              </p>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-card to-accent/5 border-border/50 backdrop-blur">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-chart-2" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  My Donations
                </h3>
              </div>
              <p className="text-3xl font-bold text-balance">
                {Number.parseFloat(myDonation).toFixed(2)} XRP
              </p>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-card to-accent/5 border-border/50 backdrop-blur">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-chart-3/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-chart-3" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Total Donors
                </h3>
              </div>
              <p className="text-3xl font-bold text-balance">{donors.length}</p>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-8 bg-gradient-to-br from-card to-accent/5 border-border/50 backdrop-blur">
              <h2 className="text-2xl font-bold mb-6 text-balance">
                Make a Donation
              </h2>

              {!account ? (
                <div className="text-center py-12">
                  <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">
                    Connect your wallet to start donating
                  </p>
                  <Button onClick={connectWallet} size="lg">
                    Connect Gem Wallet
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Amount (XRP)
                    </label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      className="text-lg h-12"
                      min="0"
                      step="0.1"
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">
                        Donation Amount
                      </span>
                      <span className="font-medium">
                        {donationAmount || "0"} XRP
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gas Fee</span>
                      <span className="font-medium">
                        {(
                          Number.parseFloat(GAS_FEE_AMOUNT) / 1_000_000
                        ).toFixed(2)}{" "}
                        XRP
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={sendDonation}
                    disabled={
                      !donationAmount ||
                      isLoading ||
                      Number.parseFloat(donationAmount) <= 0
                    }
                    className="w-full h-12 text-lg"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Donation"
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Your donation will be transferred from XRPL to XRPL EVM
                    Sidechain via Axelar
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-8 bg-gradient-to-br from-card to-accent/5 border-border/50 backdrop-blur">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-balance">
                  Donor Leaderboard
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDonationData}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {donors.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No donations yet. Be the first!
                    </p>
                  </div>
                ) : (
                  donors.map((donor) => (
                    <div
                      key={donor.address}
                      className={`p-4 rounded-lg border transition-all ${
                        donor.address.toLowerCase() === account?.toLowerCase()
                          ? "bg-primary/10 border-primary/50"
                          : "bg-muted/30 border-border/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              donor.rank === 1
                                ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                : donor.rank === 2
                                ? "bg-gray-400/20 text-gray-600 dark:text-gray-400"
                                : donor.rank === 3
                                ? "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {donor.rank}
                          </div>
                          <div>
                            <p className="font-mono text-sm font-medium">
                              {donor.address.slice(0, 6)}...
                              {donor.address.slice(-4)}
                            </p>
                            {donor.address.toLowerCase() ===
                              account?.toLowerCase() && (
                              <p className="text-xs text-primary">You</p>
                            )}
                          </div>
                        </div>
                        <p className="font-bold text-lg">
                          {Number.parseFloat(donor.amount).toFixed(2)} XRP
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={showTxModal} onOpenChange={setShowTxModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              Transaction Submitted
            </DialogTitle>
            <DialogDescription>
              Your donation transaction has been submitted successfully
            </DialogDescription>
          </DialogHeader>
          {txHash && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Transaction Hash
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm break-all">
                    {txHash}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(txHash);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => {
                    window.open(
                      `https://testnet.axelarscan.io/gmp/${txHash}`,
                      "_blank"
                    );
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on AxelarScan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
