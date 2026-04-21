import React from "react";
import { BiLabel } from "@/components/BiLabel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, Building2, ClipboardList } from "lucide-react";
import Technicians from "./Technicians";
import Clients from "./Clients";

const Registers = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-8 w-8 text-blue-600" />
        <BiLabel en="General Registers" pt="Cadastros Gerais" />
      </div>

      <Tabs defaultValue="technicians" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="technicians" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <BiLabel en="Technicians" pt="Técnicos" size="small" />
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <BiLabel en="Clients" pt="Clientes" size="small" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="technicians" className="animate-in fade-in slide-in-from-left-4 duration-300">
          <Technicians />
        </TabsContent>

        <TabsContent value="clients" className="animate-in fade-in slide-in-from-right-4 duration-300">
          <Clients />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Registers;
