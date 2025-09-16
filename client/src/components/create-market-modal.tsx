import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWallet } from "./wallet-connection";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateMarketModal({ isOpen, onClose }: CreateMarketModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [liquidity, setLiquidity] = useState("");

  const { walletAddress, isConnected } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMarketMutation = useMutation({
    mutationFn: async (marketData: any) => {
      const response = await apiRequest('POST', '/api/markets', marketData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Market Created",
        description: "Your market has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/markets'] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Market Creation Failed",
        description: error.message || "Failed to create market",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setExpiryDate("");
    setLiquidity("");
    onClose();
  };

  const handleCreateMarket = () => {
    if (!isConnected || !walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create markets.",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Invalid Title",
        description: "Please enter a market title.",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Invalid Description",
        description: "Please enter a market description.",
        variant: "destructive",
      });
      return;
    }

    if (!expiryDate) {
      toast({
        title: "Invalid Expiry Date",
        description: "Please select an expiry date.",
        variant: "destructive",
      });
      return;
    }

    const expiryDateTime = new Date(expiryDate);
    if (expiryDateTime <= new Date()) {
      toast({
        title: "Invalid Expiry Date",
        description: "Expiry date must be in the future.",
        variant: "destructive",
      });
      return;
    }

    const marketData = {
      title: title.trim(),
      description: description.trim(),
      creatorId: walletAddress,
      expiryDate: expiryDateTime.toISOString(),
      liquidity: liquidity || "0",
    };

    createMarketMutation.mutate(marketData);
  };

  // Set minimum date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card border border-border max-w-2xl" data-testid="create-market-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" data-testid="modal-title">
            Create New Market
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <Label className="block text-sm font-medium text-muted-foreground mb-2">
              Market Question
            </Label>
            <Input
              type="text"
              placeholder="Will Bitcoin reach $100,000 by December 31st, 2024?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-market-title"
            />
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-muted-foreground mb-2">
              Description
            </Label>
            <Textarea
              placeholder="Detailed market description and resolution criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-4 py-3 h-24 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              data-testid="input-market-description"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-muted-foreground mb-2">
                Expiry Date
              </Label>
              <Input
                type="datetime-local"
                min={minDate}
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-market-expiry"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-muted-foreground mb-2">
                Initial Liquidity (Optional)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="1000"
                value={liquidity}
                onChange={(e) => setLiquidity(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-market-liquidity"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={handleClose}
              data-testid="button-cancel-market"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateMarket}
              disabled={createMarketMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-create-market"
            >
              {createMarketMutation.isPending ? "Creating..." : "Create Market"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
